import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

dotenv.config();

declare global {
  var _postgresPool: Pool | undefined;
}

function isLocalhostHost(hostOrUrl: string): boolean {
  const lower = hostOrUrl.toLowerCase().trim();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '[::1]') {
    return true;
  }
  try {
    const parsed = new URL(hostOrUrl);
    const h = parsed.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  } catch {
    return false;
  }
}

export function resolvePoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim();
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_SERVICE_ID);

  if (connectionString) {
    if (isProduction && isLocalhostHost(connectionString)) {
      throw new Error(
        'Invalid DATABASE_URL for Render production: DATABASE_URL points to localhost. Configure the Render PostgreSQL connection string before starting Site Forge AI.'
      );
    }

    const requiresSsl =
      process.env.DB_SSL === 'true' ||
      connectionString.includes('sslmode=require') ||
      connectionString.includes('.render.com');

    return {
      connectionString,
      ssl:
        process.env.DB_SSL === 'false'
          ? false
          : requiresSsl
          ? { rejectUnauthorized: false }
          : undefined,
      max: 10,
      connectionTimeoutMillis: 15000,
    };
  }

  // In production, never fall back to localhost or development credentials
  if (isProduction) {
    throw new Error(
      'DATABASE_URL is not configured. Configure the Render PostgreSQL connection before starting Site Forge AI.'
    );
  }

  // Local AI Studio sandbox development fallback only when NODE_ENV !== 'production'
  if (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME) {
    return {
      host: process.env.SQL_HOST.trim(),
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
      user: process.env.SQL_USER.trim(),
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME.trim(),
      max: 10,
      connectionTimeoutMillis: 15000,
    };
  }

  throw new Error(
    'DATABASE_URL is not configured. Configure the Render PostgreSQL connection before starting Site Forge AI.'
  );
}

export const getPool = (): Pool => {
  if (!global._postgresPool) {
    const config = resolvePoolConfig();
    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL pool client:', err.message);
    });
  }
  return global._postgresPool;
};

// Initialize pool lazily or via resolved config so imports never silently connect to 127.0.0.1:5432
const poolProxy = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const activePool = getPool();
    const value = Reflect.get(activePool, prop, receiver);
    return typeof value === 'function' ? value.bind(activePool) : value;
  },
});

export const db = drizzle(poolProxy, { schema });

/**
 * Verifies that PostgreSQL is reachable using the configured DATABASE_URL
 * and ensures all required tables and columns exist without destroying data.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  const activePool = getPool();
  let client: import('pg').PoolClient | undefined;
  const maxAttempts = process.env.NODE_ENV === 'production' ? 10 : 1;
  const retryDelayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      client = await activePool.connect();
      await client.query('SELECT 1');
      console.log('Database connection established.');
      break;
    } catch (err: any) {
      const code = err?.code || err?.message || 'unreachable';

      if (attempt === maxAttempts) {
        console.error('Database connection failed.');
        console.error('Check DATABASE_URL and Render PostgreSQL configuration.');
        throw new Error(
          `Database connection failed (${code}). Check DATABASE_URL and Render PostgreSQL configuration.`
        );
      }

      console.error(
        `Database connection attempt ${attempt}/${maxAttempts} failed (${code}). Retrying in ${retryDelayMs / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  if (!client) {
    throw new Error('Database connection could not be established.');
  }

  try {
    // First check if the core schema and latest columns already exist (fast & safe for least-privilege runtime users)
    try {
      await client.query('SELECT id, github_connected FROM users LIMIT 1');
      await client.query('SELECT id, github_sync_status FROM projects LIMIT 1');
      console.log('Database schema verified.');
      return;
    } catch {
      // Tables or columns missing (e.g., fresh Render PostgreSQL instance) — proceed with idempotent DDL initialization
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT 'Developer',
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'USER',
        plan TEXT NOT NULL DEFAULT 'Pro',
        status TEXT NOT NULL DEFAULT 'active',
        email_verified BOOLEAN NOT NULL DEFAULT true,
        reset_token_hash TEXT,
        reset_token_expires_at TIMESTAMP,
        github_id TEXT,
        github_username TEXT,
        github_avatar_url TEXT,
        github_connected BOOLEAN NOT NULL DEFAULT false,
        github_token_encrypted TEXT,
        github_scopes TEXT,
        github_connected_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_connected BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_token_encrypted TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_scopes TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_connected_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        original_url TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'ANALYZE',
        scope TEXT NOT NULL DEFAULT 'SAME_DOMAIN',
        extraction_mode TEXT NOT NULL DEFAULT 'DEEP_ANALYSIS',
        status TEXT NOT NULL DEFAULT 'queued',
        pages_discovered INTEGER NOT NULL DEFAULT 0,
        assets_discovered INTEGER NOT NULL DEFAULT 0,
        project_size_bytes INTEGER NOT NULL DEFAULT 0,
        technologies_json TEXT NOT NULL DEFAULT '[]',
        analysis_score INTEGER NOT NULL DEFAULT 0,
        ai_status TEXT NOT NULL DEFAULT 'not_started',
        config_json TEXT NOT NULL DEFAULT '{}',
        github_connected BOOLEAN NOT NULL DEFAULT false,
        github_username TEXT,
        github_repository_name TEXT,
        github_repository_url TEXT,
        github_repository_id TEXT,
        github_default_branch TEXT NOT NULL DEFAULT 'main',
        last_github_commit TEXT,
        last_github_commit_url TEXT,
        last_github_push TIMESTAMP,
        github_sync_status TEXT NOT NULL DEFAULT 'not_pushed',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_analysis_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_connected BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_username TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repository_name TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repository_url TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repository_id TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_default_branch TEXT NOT NULL DEFAULT 'main';
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_github_commit TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_github_commit_url TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_github_push TIMESTAMP;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_sync_status TEXT NOT NULL DEFAULT 'not_pushed';

      CREATE TABLE IF NOT EXISTS project_pages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        page_type TEXT NOT NULL DEFAULT 'General',
        status_code INTEGER NOT NULL DEFAULT 200,
        html_content TEXT NOT NULL DEFAULT '',
        meta_json TEXT NOT NULL DEFAULT '{}',
        is_auth_ui BOOLEAN NOT NULL DEFAULT false,
        selected BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_assets (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        local_path TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'text/plain',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        status_code INTEGER NOT NULL DEFAULT 200,
        content_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crawl_jobs (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'queued',
        pages_total INTEGER NOT NULL DEFAULT 0,
        pages_processed INTEGER NOT NULL DEFAULT 0,
        assets_total INTEGER NOT NULL DEFAULT 0,
        assets_processed INTEGER NOT NULL DEFAULT 0,
        current_step TEXT NOT NULL DEFAULT 'Queued',
        error_message TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crawl_events (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        level TEXT NOT NULL DEFAULT 'info',
        step TEXT NOT NULL DEFAULT 'crawler',
        message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS analysis_results (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        technologies_json TEXT NOT NULL DEFAULT '[]',
        colors_json TEXT NOT NULL DEFAULT '[]',
        fonts_json TEXT NOT NULL DEFAULT '[]',
        navigation_json TEXT NOT NULL DEFAULT '[]',
        components_json TEXT NOT NULL DEFAULT '[]',
        breakpoints_json TEXT NOT NULL DEFAULT '[]',
        external_resources_json TEXT NOT NULL DEFAULT '[]',
        recommendations_json TEXT NOT NULL DEFAULT '[]',
        summary_report_md TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS generated_projects (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL DEFAULT 1,
        version_label TEXT NOT NULL DEFAULT 'Initial reconstruction',
        prompt_used TEXT NOT NULL DEFAULT '',
        framework TEXT NOT NULL DEFAULT 'React + Tailwind + Vite',
        database_schema_json TEXT NOT NULL DEFAULT '[]',
        preview_html TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS generated_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version_id INTEGER NOT NULL REFERENCES generated_projects(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'typescript',
        content TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_generations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'gemini',
        model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
        operation_type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response_summary TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'completed',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        download_type TEXT NOT NULL DEFAULT 'FULL_ZIP',
        file_name TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier TEXT NOT NULL DEFAULT 'Pro',
        status TEXT NOT NULL DEFAULT 'active',
        crawl_pages_limit INTEGER NOT NULL DEFAULT 10000,
        storage_limit_bytes INTEGER NOT NULL DEFAULT 1073741824,
        ai_generations_limit INTEGER NOT NULL DEFAULT 1000,
        current_period_end TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        job_id INTEGER,
        action TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        details TEXT NOT NULL DEFAULT '',
        ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Database schema verified.');
  } catch (err: any) {
    console.error('Database schema verification failed:', err?.message || 'Unknown error');
    throw new Error(`Database schema verification failed: ${err?.message || 'Unknown error'}`);
  } finally {
    client.release();
  }
}
