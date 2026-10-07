import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default('Developer'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('USER'), // USER | ADMIN | SUPER_ADMIN
  plan: text('plan').notNull().default('Pro'), // Free | Pro | Business | Enterprise
  status: text('status').notNull().default('active'), // active | suspended
  emailVerified: boolean('email_verified').notNull().default(true),
  resetTokenHash: text('reset_token_hash'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  githubId: text('github_id'),
  githubUsername: text('github_username'),
  githubAvatarUrl: text('github_avatar_url'),
  githubConnected: boolean('github_connected').notNull().default(false),
  githubTokenEncrypted: text('github_token_encrypted'),
  githubScopes: text('github_scopes'),
  githubConnectedAt: timestamp('github_connected_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  originalUrl: text('original_url').notNull(),
  mode: text('mode').notNull().default('ANALYZE'), // DOWNLOAD | ANALYZE | RECREATE | PAGE_ONLY
  scope: text('scope').notNull().default('SAME_DOMAIN'), // ENTIRE | SINGLE_PAGE | SELECTED_PAGES | SAME_DOMAIN | CUSTOM_LIST
  extractionMode: text('extraction_mode').notNull().default('DEEP_ANALYSIS'), // STATIC_MIRROR | FRONTEND_ANALYSIS | DEEP_ANALYSIS | AI_RECONSTRUCTION
  status: text('status').notNull().default('queued'), // queued | validating | crawling | analyzing | reconstructing | packaging | completed | failed | cancelled
  pagesDiscovered: integer('pages_discovered').notNull().default(0),
  assetsDiscovered: integer('assets_discovered').notNull().default(0),
  projectSizeBytes: integer('project_size_bytes').notNull().default(0),
  technologiesJson: text('technologies_json').notNull().default('[]'),
  analysisScore: integer('analysis_score').notNull().default(0),
  aiStatus: text('ai_status').notNull().default('not_started'), // not_started | reconstructing | ready | failed
  configJson: text('config_json').notNull().default('{}'),
  githubConnected: boolean('github_connected').notNull().default(false),
  githubUsername: text('github_username'),
  githubRepositoryName: text('github_repository_name'),
  githubRepositoryUrl: text('github_repository_url'),
  githubRepositoryId: text('github_repository_id'),
  githubDefaultBranch: text('github_default_branch').notNull().default('main'),
  lastGithubCommit: text('last_github_commit'),
  lastGithubCommitUrl: text('last_github_commit_url'),
  lastGithubPush: timestamp('last_github_push'),
  githubSyncStatus: text('github_sync_status').notNull().default('not_pushed'), // not_pushed | syncing | synced | failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastAnalysisAt: timestamp('last_analysis_at').defaultNow().notNull(),
});

export const projectPages = pgTable('project_pages', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  path: text('path').notNull(),
  title: text('title').notNull(),
  pageType: text('page_type').notNull().default('General'), // Home | Login | Register | Forgot Password | Dashboard | Profile | Settings | Pricing | About | Contact | Products | Documentation | Blog | Other
  statusCode: integer('status_code').notNull().default(200),
  htmlContent: text('html_content').notNull().default(''),
  metaJson: text('meta_json').notNull().default('{}'),
  isAuthUi: boolean('is_auth_ui').notNull().default(false),
  selected: boolean('selected').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projectAssets = pgTable('project_assets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  localPath: text('local_path').notNull(),
  assetType: text('asset_type').notNull(), // html | css | js | image | svg | font | json | other
  mimeType: text('mime_type').notNull().default('text/plain'),
  sizeBytes: integer('size_bytes').notNull().default(0),
  statusCode: integer('status_code').notNull().default(200),
  contentText: text('content_text').notNull().default(''),
  contentBase64: text('content_base64'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const crawlJobs = pgTable('crawl_jobs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull().default('queued'), // queued | validating | crawling | analyzing | reconstructing | packaging | completed | failed | cancelled
  pagesTotal: integer('pages_total').notNull().default(0),
  pagesProcessed: integer('pages_processed').notNull().default(0),
  assetsTotal: integer('assets_total').notNull().default(0),
  assetsProcessed: integer('assets_processed').notNull().default(0),
  currentStep: text('current_step').notNull().default('Queued'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const crawlEvents = pgTable('crawl_events', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').references(() => crawlJobs.id, { onDelete: 'cascade' }).notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  level: text('level').notNull().default('info'), // info | warn | error | success
  step: text('step').notNull().default('crawler'),
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const analysisResults = pgTable('analysis_results', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  technologiesJson: text('technologies_json').notNull().default('[]'),
  colorsJson: text('colors_json').notNull().default('[]'),
  fontsJson: text('fonts_json').notNull().default('[]'),
  navigationJson: text('navigation_json').notNull().default('[]'),
  componentsJson: text('components_json').notNull().default('[]'),
  breakpointsJson: text('breakpoints_json').notNull().default('[]'),
  externalResourcesJson: text('external_resources_json').notNull().default('[]'),
  recommendationsJson: text('recommendations_json').notNull().default('[]'),
  summaryReportMd: text('summary_report_md').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const generatedProjects = pgTable('generated_projects', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull().default(1),
  versionLabel: text('version_label').notNull().default('Initial reconstruction'),
  promptUsed: text('prompt_used').notNull().default(''),
  framework: text('framework').notNull().default('React + Tailwind + Vite'),
  databaseSchemaJson: text('database_schema_json').notNull().default('[]'),
  previewHtml: text('preview_html').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const generatedFiles = pgTable('generated_files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  versionId: integer('version_id').references(() => generatedProjects.id, { onDelete: 'cascade' }).notNull(),
  filePath: text('file_path').notNull(),
  language: text('language').notNull().default('typescript'),
  content: text('content').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiGenerations = pgTable('ai_generations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: text('provider').notNull().default('gemini'),
  model: text('model').notNull().default('gemini-3.8-flash'),
  operationType: text('operation_type').notNull(), // recreate | modify | regenerate_file | generate_db | explain_code
  prompt: text('prompt').notNull(),
  responseSummary: text('response_summary').notNull().default(''),
  status: text('status').notNull().default('completed'),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const downloads = pgTable('downloads', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  downloadType: text('download_type').notNull().default('FULL_ZIP'), // FULL_ZIP | SOURCE_ONLY | ASSETS_ONLY | SINGLE_FILE | REPORT
  fileName: text('file_name').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tier: text('tier').notNull().default('Pro'), // Free | Pro | Business | Enterprise
  status: text('status').notNull().default('active'),
  crawlPagesLimit: integer('crawl_pages_limit').notNull().default(10000),
  storageLimitBytes: integer('storage_limit_bytes').notNull().default(1073741824),
  aiGenerationsLimit: integer('ai_generations_limit').notNull().default(1000),
  currentPeriodEnd: timestamp('current_period_end').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  jobId: integer('job_id'),
  action: text('action').notNull(),
  status: text('status').notNull().default('success'),
  durationMs: integer('duration_ms').notNull().default(0),
  details: text('details').notNull().default(''),
  ipAddress: text('ip_address').notNull().default('127.0.0.1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // info | success | warning | error
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  notifications: many(notifications),
  apiKeys: many(apiKeys),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.userId], references: [users.id] }),
  pages: many(projectPages),
  assets: many(projectAssets),
  jobs: many(crawlJobs),
  versions: many(generatedProjects),
}));
