import assert from 'node:assert/strict';
import {
  isPrivateIp,
  classifyPageType,
  detectTechnologies,
  extractColorsAndFonts,
} from '../src/server/crawler.ts';
import {
  encryptGithubToken,
  decryptGithubToken,
  createOAuthState,
  consumeOAuthState,
  validateRepositoryName,
} from '../src/server/github.ts';
import { resolvePoolConfig, ensureDatabaseSchema, getPool } from '../src/db/index.ts';

async function runTests() {
  console.log('Running SiteForge AI test suite...');

  // 1. SSRF Private IP Protection Tests
  assert.equal(isPrivateIp('127.0.0.1'), true, '127.0.0.1 must be blocked');
  assert.equal(isPrivateIp('10.0.0.1'), true, '10.x.x.x must be blocked');
  assert.equal(isPrivateIp('172.16.5.4'), true, '172.16.x.x must be blocked');
  assert.equal(isPrivateIp('192.168.1.1'), true, '192.168.x.x must be blocked');
  assert.equal(isPrivateIp('169.254.169.254'), true, 'Cloud metadata IP must be blocked');
  assert.equal(isPrivateIp('93.184.216.34'), false, 'Public IP should be allowed');
  console.log('✓ SSRF private IP protection verified');

  // 2. Page Classification & Auth UI Sanitization Detection
  const homeClass = classifyPageType('/', 'Welcome to Example', false);
  assert.equal(homeClass.pageType, 'Home');
  assert.equal(homeClass.isAuthUi, false);

  const loginClass = classifyPageType('/auth/login', 'Sign In', true);
  assert.equal(loginClass.pageType, 'Login');
  assert.equal(loginClass.isAuthUi, true);

  const pricingClass = classifyPageType('/pricing', 'Plans & Pricing', false);
  assert.equal(pricingClass.pageType, 'Pricing');
  console.log('✓ Route and Authentication UI classification verified');

  // 3. Technology Stack Detection
  const sampleNextHtml = '<html><body><div id="__NEXT_DATA__"></div><div class="flex bg-slate-900 px-4"></div></body></html>';
  const techs = detectTechnologies(sampleNextHtml, { server: 'cloudflare' }, ['/_next/static/chunks/main.js'], []);
  const techNames = techs.map((t) => t.name);
  assert.ok(techNames.includes('Next.js'), 'Should detect Next.js');
  assert.ok(techNames.includes('React'), 'Should detect React');
  assert.ok(techNames.includes('Tailwind CSS'), 'Should detect Tailwind CSS');
  assert.ok(techNames.includes('Cloudflare'), 'Should detect Cloudflare');
  console.log('✓ Technology signature detection verified');

  // 4. Design System Token Extraction
  const extracted = extractColorsAndFonts(
    '<div style="color: #4f46e5; background: #0f172a;"></div>',
    ['body { font-family: "Plus Jakarta Sans", sans-serif; color: #4F46E5; } @media (min-width: 1024px) {}']
  );
  assert.ok(extracted.colors.some((c) => c.hex === '#4F46E5'), 'Should extract #4F46E5');
  assert.ok(extracted.fonts.includes('Plus Jakarta Sans'), 'Should extract Plus Jakarta Sans');
  console.log('✓ Design token extraction verified');

  // 5. GitHub OAuth Token AES-256-GCM Encryption & CSRF State Validation
  const sampleToken = 'gho_test_secret_oauth_token_1234567890';
  const encrypted = encryptGithubToken(sampleToken);
  assert.notEqual(encrypted, sampleToken, 'Encrypted token must not equal plaintext');
  const decrypted = decryptGithubToken(encrypted);
  assert.equal(decrypted, sampleToken, 'Decrypted token must match original token');

  const state = createOAuthState('https://example.com/auth/github/callback', 42);
  const consumed = consumeOAuthState(state);
  assert.ok(consumed, 'State should be valid on first consumption');
  assert.equal(consumed?.userId, 42);
  const replay = consumeOAuthState(state);
  assert.equal(replay, null, 'Replayed CSRF state must be rejected');
  console.log('✓ GitHub AES-256-GCM token encryption & single-use CSRF state verified');

  // 6. GitHub Repository Name Validation
  assert.equal(validateRepositoryName('siteforge-reconstructed-app').valid, true);
  assert.equal(validateRepositoryName('valid_repo.v1').valid, true);
  assert.equal(validateRepositoryName('invalid repo spaces').valid, false);
  assert.equal(validateRepositoryName('.hidden').valid, false);
  console.log('✓ GitHub repository name validation verified');

  // 7. Production DATABASE_URL & Render PostgreSQL Configuration Validation
  const origDbUrl = process.env.DATABASE_URL;
  const origSqlHost = process.env.SQL_HOST;
  const origRender = process.env.RENDER;
  const origNodeEnv = process.env.NODE_ENV;
  try {
    process.env.RENDER = 'true';
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.SQL_HOST;

    assert.throws(
      () => resolvePoolConfig(),
      /DATABASE_URL is not configured/,
      'Must fail with clear error instead of falling back to localhost:5432 when DATABASE_URL is missing in production'
    );

    process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/siteforge';
    assert.throws(
      () => resolvePoolConfig(),
      /Invalid DATABASE_URL for Render production/,
      'Must reject localhost DATABASE_URL when running on Render'
    );

    process.env.DATABASE_URL = 'postgresql://siteforge_app:secret@dpg-sample-a/siteforge';
    const renderInternalCfg = resolvePoolConfig();
    assert.equal(renderInternalCfg.connectionString, 'postgresql://siteforge_app:secret@dpg-sample-a/siteforge');
    assert.equal(renderInternalCfg.ssl, undefined, 'Internal Render connection should not force SSL unless requested');

    process.env.DATABASE_URL = 'postgresql://siteforge_app:secret@dpg-sample-a.oregon-postgres.render.com/siteforge';
    const renderExternalCfg = resolvePoolConfig();
    assert.deepEqual(renderExternalCfg.ssl, { rejectUnauthorized: false }, 'External Render connection should enable SSL');
    console.log('✓ Production DATABASE_URL & Render PostgreSQL configuration verified');
  } finally {
    if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
    else delete process.env.DATABASE_URL;
    if (origSqlHost !== undefined) process.env.SQL_HOST = origSqlHost;
    else delete process.env.SQL_HOST;
    if (origRender !== undefined) process.env.RENDER = origRender;
    else delete process.env.RENDER;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
  }

  // 8. Live PostgreSQL Connection & Schema Verification via DATABASE_URL
  if (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME) {
    const prevDbUrl = process.env.DATABASE_URL;
    try {
      const encodedUser = encodeURIComponent(process.env.SQL_USER);
      const encodedPass = encodeURIComponent(process.env.SQL_PASSWORD || '');
      const port = process.env.SQL_PORT || '5432';
      process.env.DATABASE_URL = `postgresql://${encodedUser}:${encodedPass}@${process.env.SQL_HOST}:${port}/${process.env.SQL_DB_NAME}`;
      const liveCfg = resolvePoolConfig();
      assert.ok(liveCfg.connectionString?.startsWith('postgresql://'), 'Should use DATABASE_URL connectionString');
      await ensureDatabaseSchema();
      await getPool().end();
      global._postgresPool = undefined;
      console.log('✓ Live PostgreSQL connection & schema verification via DATABASE_URL succeeded');
    } finally {
      if (prevDbUrl !== undefined) process.env.DATABASE_URL = prevDbUrl;
      else delete process.env.DATABASE_URL;
    }
  }

  console.log('All SiteForge AI unit tests passed!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
