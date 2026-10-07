import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { db, ensureDatabaseSchema } from './src/db/index.ts';
import {
  users,
  projects,
  projectPages,
  projectAssets,
  crawlJobs,
  analysisResults,
  generatedProjects,
  generatedFiles,
  aiGenerations,
  downloads,
  apiKeys,
  subscriptions,
  auditLogs,
  notifications,
  systemSettings,
} from './src/db/schema.ts';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import {
  createLocalUser,
  getOrCreateGithubUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSessionUser,
  deleteSessionByToken,
  setResetToken,
  consumeResetTokenAndSetPassword,
  getUserProjects,
  getProjectByIdForUser,
  getProjectFullDetails,
  createAuditLog,
  createNotification,
  hashToken,
} from './src/db/repository.ts';
import { requireAuth, requireAdmin, AuthRequest } from './src/middleware/auth.ts';
import {
  validateAndNormalizeUrl,
  startBackgroundCrawlJob,
  cancelActiveCrawlJob,
  subscribeToProject,
} from './src/server/crawler.ts';
import {
  runAIProjectReconstruction,
  getActiveAIProvider,
} from './src/server/ai-provider.ts';
import { buildProjectZipArchive } from './src/server/zip-builder.ts';
import {
  getGithubConfig,
  resolveGithubCallbackUrl,
  buildGithubAuthorizeUrl,
  consumeOAuthState,
  exchangeGithubCodeForToken,
  fetchGithubUserProfile,
  encryptGithubToken,
  createGithubRepositoryForUser,
  pushProjectToGithubRepository,
  disconnectGithubForUser,
} from './src/server/github.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log('Starting server...');
  await ensureDatabaseSchema();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ============================================================================
  // HEALTH & READINESS CHECKS
  // ============================================================================
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'siteforge-ai',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await db.select({ id: users.id }).from(users).limit(1);
      const ghCfg = getGithubConfig();
      res.json({
        status: 'ready',
        database: 'connected',
        aiProvider: process.env.AI_PROVIDER || 'gemini',
        aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
        githubConfigured: ghCfg.isConfigured,
      });
    } catch (error: any) {
      res.status(503).json({
        status: 'not_ready',
        database: 'unavailable',
        error: 'Database readiness check failed.',
      });
    }
  });

  // ============================================================================
  // OPENAPI 3.1 SPECIFICATION
  // ============================================================================
  app.get('/api/openapi.json', (_req, res) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'SiteForge AI Platform API',
        version: '1.0.0',
        description: 'REST API for authorized website analysis, crawling, source code extraction, and AI reconstruction.',
      },
      paths: {
        '/api/projects': {
          get: { summary: 'List all user projects' },
          post: { summary: 'Create a new website analysis project and start crawl job' },
        },
        '/api/projects/{id}': {
          get: { summary: 'Retrieve full project analysis, pages, assets, versions, and generated source files' },
          delete: { summary: 'Delete project and associated artifacts' },
        },
        '/api/projects/{id}/analyze': {
          post: { summary: 'Trigger a new background crawl and structural analysis job' },
        },
        '/api/projects/{id}/recreate': {
          post: { summary: 'Execute AI reconstruction or versioned AI modification on project' },
        },
        '/api/projects/{id}/files': {
          get: { summary: 'List generated source code files for active or specified version' },
        },
        '/api/projects/{id}/download': {
          get: { summary: 'Generate and download validated project ZIP archive' },
        },
        '/api/projects/{id}/github/create-repo': {
          post: { summary: 'Create a new GitHub repository for the reconstructed project' },
        },
        '/api/projects/{id}/github/push': {
          post: { summary: 'Commit and push all generated project files to GitHub' },
        },
        '/api/jobs/{id}/cancel': {
          post: { summary: 'Cancel an active background crawl job' },
        },
        '/api/jobs/{id}/retry': {
          post: { summary: 'Retry a failed or cancelled crawl job' },
        },
      },
    });
  });

  // ============================================================================
  // GITHUB OAUTH & AUTHENTICATION ROUTES
  // ============================================================================
  app.get('/api/auth/github/status', (req, res) => {
    const cfg = getGithubConfig();
    const origin = (req.query.origin as string) || `${req.protocol}://${req.get('host')}`;
    const callbackUrl = resolveGithubCallbackUrl(origin);
    res.json({
      configured: cfg.isConfigured,
      callbackUrl,
      hasClientId: Boolean(cfg.clientId && cfg.clientId !== 'YOUR_GITHUB_CLIENT_ID'),
      hasClientSecret: Boolean(cfg.clientSecret && cfg.clientSecret !== 'YOUR_GITHUB_CLIENT_SECRET'),
    });
  });

  app.get('/api/auth/github/url', async (req, res) => {
    try {
      const cfg = getGithubConfig();
      const origin = (req.query.origin as string) || `${req.protocol}://${req.get('host')}`;
      const callbackUrl = resolveGithubCallbackUrl(origin);

      if (!cfg.isConfigured) {
        return res.status(503).json({
          error:
            'GitHub integration is not configured. Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables.',
          configurationError: true,
          callbackUrl,
          requiredEnvVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL'],
        });
      }

      let existingUserId: number | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer sf_sess_')) {
        const rawToken = authHeader.split('Bearer ')[1].trim();
        const sessUser = await getSessionUser(rawToken);
        if (sessUser) existingUserId = sessUser.id;
      }

      const authData = buildGithubAuthorizeUrl(origin, existingUserId);
      res.json(authData);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to construct GitHub OAuth URL.' });
    }
  });

  app.get(['/auth/github', '/api/auth/github'], (req, res) => {
    try {
      const origin = (req.query.origin as string) || `${req.protocol}://${req.get('host')}`;
      const cfg = getGithubConfig();
      if (!cfg.isConfigured) {
        const callbackUrl = resolveGithubCallbackUrl(origin);
        return res.status(503).send(`
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>GitHub OAuth Configuration Required — SiteForge AI</title>
              <style>
                body { background: #090D16; color: #F8FAFC; font-family: system-ui, sans-serif; padding: 2.5rem; max-width: 600px; margin: 0 auto; line-height: 1.6; }
                .card { background: #0F1624; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem; }
                code { background: #020617; padding: 0.2rem 0.4rem; border-radius: 4px; color: #818CF8; font-family: monospace; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>GitHub integration is not configured</h2>
                <p>Set the following environment variables in Render or AI Studio Secrets:</p>
                <ul>
                  <li><code>GITHUB_CLIENT_ID</code></li>
                  <li><code>GITHUB_CLIENT_SECRET</code></li>
                  <li><code>GITHUB_CALLBACK_URL</code> = <code>${callbackUrl}</code></li>
                </ul>
              </div>
            </body>
          </html>
        `);
      }
      const { url } = buildGithubAuthorizeUrl(origin);
      res.redirect(url);
    } catch (error: any) {
      res.status(500).send(error.message || 'GitHub OAuth redirect failed.');
    }
  });

  const githubCallbackHandler = async (req: express.Request, res: express.Response) => {
    try {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const errorParam = req.query.error as string | undefined;
      const errorDesc = req.query.error_description as string | undefined;

      if (errorParam) {
        throw new Error(errorDesc || `GitHub authorization was denied (${errorParam}).`);
      }
      if (!code || !state) {
        throw new Error('Missing OAuth code or CSRF state parameter from GitHub callback.');
      }

      const stateEntry = consumeOAuthState(state);
      if (!stateEntry) {
        throw new Error('Invalid or expired OAuth CSRF state parameter. Please try signing in again.');
      }

      const { accessToken, scope } = await exchangeGithubCodeForToken(code, stateEntry.redirectUri);
      const profile = await fetchGithubUserProfile(accessToken);
      const encryptedToken = encryptGithubToken(accessToken);

      const user = await getOrCreateGithubUser({
        githubId: profile.id,
        githubUsername: profile.login,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        encryptedToken,
        scopes: scope,
        existingUserId: stateEntry.userId,
      });

      if (user.status === 'suspended') {
        throw new Error('This account has been suspended by an administrator.');
      }

      const sessionToken = await createSession(user.id);

      await createAuditLog({
        userId: user.id,
        action: 'GITHUB_OAUTH_LOGIN',
        status: 'success',
        details: `Authenticated via GitHub OAuth as @${profile.login}`,
        ipAddress: req.ip,
      });

      const safeUserPayload = {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        status: user.status,
        githubConnected: user.githubConnected,
        githubUsername: user.githubUsername,
        githubAvatarUrl: user.githubAvatarUrl,
        githubScopes: user.githubScopes,
      };

      res.send(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>GitHub Connected — SiteForge AI</title>
            <style>
              body { background: #090D16; color: #F8FAFC; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .box { background: #0F1624; border: 1px solid #1E293B; border-radius: 12px; padding: 2rem; text-align: center; max-width: 420px; }
            </style>
          </head>
          <body>
            <div class="box">
              <h3>GitHub Authenticated (@${profile.login})</h3>
              <p>Returning to SiteForge AI workspace...</p>
            </div>
            <script>
              (function() {
                var payload = {
                  type: 'OAUTH_AUTH_SUCCESS',
                  provider: 'github',
                  token: ${JSON.stringify(sessionToken)},
                  user: ${JSON.stringify(safeUserPayload)}
                };
                if (window.opener) {
                  window.opener.postMessage(payload, '*');
                  window.close();
                } else {
                  window.location.href = '/?github_token=' + encodeURIComponent(payload.token);
                }
              })();
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      const errMsg = error.message || 'GitHub authentication failed.';
      res.status(400).send(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>GitHub Authentication Error — SiteForge AI</title>
            <style>
              body { background: #090D16; color: #F8FAFC; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .box { background: #0F1624; border: 1px solid #7F1D1D; border-radius: 12px; padding: 2rem; text-align: center; max-width: 460px; }
              .err { color: #FCA5A5; font-size: 0.9rem; margin: 1rem 0; }
              a, button { display: inline-block; margin-top: 1rem; padding: 0.6rem 1.2rem; background: #4F46E5; color: #fff; border: none; border-radius: 8px; text-decoration: none; cursor: pointer; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="box">
              <h3>GitHub Sign-In Could Not Complete</h3>
              <p class="err">${errMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
              <button onclick="if(window.opener){window.opener.postMessage({type:'OAUTH_AUTH_ERROR',error:${JSON.stringify(errMsg)}},'*');window.close();}else{window.location.href='/';}">Return to SiteForge AI</button>
            </div>
          </body>
        </html>
      `);
    }
  };

  app.get(
    [
      '/auth/github/callback',
      '/auth/github/callback/',
      '/api/auth/github/callback',
      '/api/auth/github/callback/',
    ],
    githubCallbackHandler
  );

  app.post('/api/github/disconnect', requireAuth, async (req: AuthRequest, res) => {
    try {
      await disconnectGithubForUser(req.authUser!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to disconnect GitHub account.' });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, name, password } = req.body;
      if (!email || !password || password.length < 8) {
        return res.status(400).json({ error: 'Valid email and password (minimum 8 characters) are required.' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await createLocalUser(email, name || email.split('@')[0], passwordHash);
      const token = await createSession(user.id);

      await createAuditLog({
        userId: user.id,
        action: 'USER_SIGNUP',
        status: 'success',
        details: `Account registered for ${user.email}`,
        ipAddress: req.ip,
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          status: user.status,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      const user = await getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        await createAuditLog({
          userId: user.id,
          action: 'USER_LOGIN_FAILED',
          status: 'error',
          details: 'Invalid password attempt',
          ipAddress: req.ip,
        });
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const token = await createSession(user.id);
      await createAuditLog({
        userId: user.id,
        action: 'USER_LOGIN',
        status: 'success',
        details: 'Session established',
        ipAddress: req.ip,
      });

      res.json({
        token,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          status: user.status,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Login failed.' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer sf_sess_')) {
      const token = authHeader.split('Bearer ')[1].trim();
      await deleteSessionByToken(token);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await getUserById(req.authUser!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
      const userNotifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(30);

      res.json({
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          status: user.status,
          githubConnected: user.githubConnected,
          githubUsername: user.githubUsername,
          githubAvatarUrl: user.githubAvatarUrl,
          githubScopes: user.githubScopes,
          githubConnectedAt: user.githubConnectedAt,
          createdAt: user.createdAt,
        },
        subscription: sub || null,
        notifications: userNotifs,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load profile.' });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email address is required.' });
      }
      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'No registered account found matching that email address.' });
      }

      const rawResetToken = `sf_rst_${crypto.randomBytes(24).toString('hex')}`;
      await setResetToken(user.id, rawResetToken);

      await createAuditLog({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        status: 'success',
        details: `Single-use reset token generated for ${user.email}`,
        ipAddress: req.ip,
      });

      const emailProvider = process.env.EMAIL_PROVIDER;
      const emailApiKey = process.env.EMAIL_API_KEY;

      if (!emailProvider || !emailApiKey) {
        return res.status(503).json({
          error: 'Email provider is not configured: EMAIL_PROVIDER and EMAIL_API_KEY environment variables are missing.',
          configurationError: true,
          verificationResetToken: rawResetToken,
          message:
            'Single-use cryptographic reset token has been generated and hashed in PostgreSQL. Because SMTP/Resend credentials (EMAIL_PROVIDER / EMAIL_API_KEY) are not configured in environment variables, you can use the generated token directly below to complete password reset verification.',
        });
      }

      // Real HTTP dispatch for Resend / SendGrid when configured
      if (emailProvider.toLowerCase() === 'resend') {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emailApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'security@siteforge.ai',
            to: [user.email],
            subject: 'SiteForge AI — Password Reset Token',
            html: `<p>Use the following single-use reset token to reset your SiteForge AI password:</p><pre>${rawResetToken}</pre>`,
          }),
        });
        if (!emailRes.ok) {
          const errText = await emailRes.text();
          return res.status(502).json({ error: `Email provider error: ${errText}` });
        }
      }

      res.json({
        success: true,
        message: 'Password reset link and token dispatched via configured email provider.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Password reset request failed.' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Valid reset token and new password (min 8 chars) are required.' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const user = await consumeResetTokenAndSetPassword(token.trim(), passwordHash);

      await createAuditLog({
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        status: 'success',
        details: 'Single-use token consumed and password updated',
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: 'Password has been reset. You may now log in with your new password.',
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to reset password.' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      const user = await getUserById(req.authUser!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      if (user.passwordHash && currentPassword) {
        const matches = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!matches) {
          return res.status(400).json({ error: 'Current password is incorrect.' });
        }
      }
      const newHash = await bcrypt.hash(newPassword, 12);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
      await createNotification(user.id, 'Password Updated', 'Your account password was changed successfully.', 'success');
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update password.' });
    }
  });

  app.delete('/api/auth/account', requireAuth, async (req: AuthRequest, res) => {
    try {
      await db.delete(users).where(eq(users.id, req.authUser!.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete account.' });
    }
  });

  // ============================================================================
  // DASHBOARD & USER SETTINGS ROUTES
  // ============================================================================
  app.get('/api/dashboard/overview', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const userProjects = await getUserProjects(userId);
      const userJobs = await db
        .select()
        .from(crawlJobs)
        .where(eq(crawlJobs.userId, userId))
        .orderBy(desc(crawlJobs.createdAt))
        .limit(25);
      const userAiGens = await db
        .select()
        .from(aiGenerations)
        .where(eq(aiGenerations.userId, userId))
        .orderBy(desc(aiGenerations.createdAt))
        .limit(25);
      const userDownloads = await db
        .select()
        .from(downloads)
        .where(eq(downloads.userId, userId))
        .orderBy(desc(downloads.createdAt))
        .limit(25);
      const userKeys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt));

      const totalStorageBytes = userProjects.reduce((acc, p) => acc + (p.projectSizeBytes || 0), 0);
      const activeJobsCount = userJobs.filter((j) => ['queued', 'validating', 'crawling', 'analyzing', 'reconstructing', 'packaging'].includes(j.status)).length;
      const completedAnalysesCount = userProjects.filter((p) => p.status === 'completed').length;
      const generatedWebsitesCount = userProjects.filter((p) => p.aiStatus === 'ready').length;

      res.json({
        stats: {
          projectsCount: userProjects.length,
          activeJobsCount,
          completedAnalysesCount,
          generatedWebsitesCount,
          downloadsCount: userDownloads.length,
          totalStorageBytes,
        },
        projects: userProjects,
        jobs: userJobs,
        aiGenerations: userAiGens,
        downloads: userDownloads,
        apiKeys: userKeys,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load dashboard overview.' });
    }
  });

  app.post('/api/notifications/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, req.authUser!.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to mark notifications as read.' });
    }
  });

  app.post('/api/keys', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Key name is required.' });
      }
      const rawKey = `sf_live_${crypto.randomBytes(24).toString('hex')}`;
      const keyPrefix = `${rawKey.slice(0, 14)}...`;
      const keyHash = hashToken(rawKey);

      const [created] = await db
        .insert(apiKeys)
        .values({
          userId: req.authUser!.id,
          name: name.trim(),
          keyPrefix,
          keyHash,
        })
        .returning();

      res.status(201).json({
        apiKey: created,
        rawSecretKey: rawKey,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate API key.' });
    }
  });

  app.delete('/api/keys/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const keyId = Number(req.params.id);
      await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, req.authUser!.id)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to revoke API key.' });
    }
  });

  app.post('/api/billing/plan', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { tier } = req.body;
      const limits: Record<string, { pages: number; storage: number; ai: number }> = {
        Free: { pages: 500, storage: 104857600, ai: 50 },
        Pro: { pages: 10000, storage: 1073741824, ai: 1000 },
        Business: { pages: 50000, storage: 10737418240, ai: 5000 },
        Enterprise: { pages: 500000, storage: 107374182400, ai: 50000 },
      };
      const selected = limits[tier] || limits.Pro;

      await db.update(users).set({ plan: tier }).where(eq(users.id, req.authUser!.id));
      await db
        .update(subscriptions)
        .set({
          tier,
          crawlPagesLimit: selected.pages,
          storageLimitBytes: selected.storage,
          aiGenerationsLimit: selected.ai,
        })
        .where(eq(subscriptions.userId, req.authUser!.id));

      await createNotification(req.authUser!.id, 'Subscription Updated', `Your workspace plan is now set to ${tier}.`, 'success');
      res.json({ success: true, tier });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update billing plan.' });
    }
  });

  // ============================================================================
  // PROJECTS, CRAWLER, AI RECONSTRUCTION & EXPORT ROUTES
  // ============================================================================
  app.get('/api/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await getUserProjects(req.authUser!.id);
      res.json({ projects: list });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { url, name, mode, config, acceptedAcceptableUse } = req.body;
      if (!acceptedAcceptableUse) {
        return res.status(400).json({
          error: 'Acceptable Use Policy confirmation is required: You must confirm you own or are authorized to analyze this website.',
        });
      }
      const normalizedUrl = await validateAndNormalizeUrl(url);

      // Prevent the public analyzer from crawling the Site Forge application itself.
      // The authorization checkbox confirms user permission but does not disable
      // server-side SSRF, safety, or application self-crawl protections.
      const requestHost = String(req.get('host') || '').split(':')[0].toLowerCase();
      const configuredAppHosts = [requestHost, 'siteforge.ai', 'www.siteforge.ai'];
      if (process.env.RENDER_EXTERNAL_URL) {
        try {
          configuredAppHosts.push(new URL(process.env.RENDER_EXTERNAL_URL).hostname.toLowerCase());
        } catch {
          // Ignore an invalid optional Render URL; normal deployment host checking still applies.
        }
      }
      if (configuredAppHosts.filter(Boolean).includes(normalizedUrl.hostname.toLowerCase())) {
        return res.status(400).json({
          error: 'Site Forge AI cannot analyze or copy its own website. Please enter another website you own or have permission to analyze.',
        });
      }

      const projectName = (name || normalizedUrl.hostname.replace(/^www\./, '')).trim();

      const [project] = await db
        .insert(projects)
        .values({
          userId: req.authUser!.id,
          name: projectName,
          originalUrl: normalizedUrl.toString(),
          mode: mode || 'ANALYZE',
          scope: config?.scope || 'SAME_DOMAIN',
          extractionMode: config?.extractionMode || 'DEEP_ANALYSIS',
          status: 'queued',
          configJson: JSON.stringify(config || {}),
        })
        .returning();

      const job = await startBackgroundCrawlJob(project.id, req.authUser!.id, config);

      res.status(201).json({ project, job });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create project.' });
    }
  });

  app.get('/api/projects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const isAdmin = req.authUser!.role === 'ADMIN' || req.authUser!.role === 'SUPER_ADMIN';
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, isAdmin);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found or access denied.' });
      }
      const fullDetails = await getProjectFullDetails(projectId);
      res.json(fullDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/projects/:id/files', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const isAdmin = req.authUser!.role === 'ADMIN' || req.authUser!.role === 'SUPER_ADMIN';
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, isAdmin);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const details = await getProjectFullDetails(projectId);
      res.json({
        version: details?.latestVersion || null,
        files: details?.files || [],
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/projects/:id/stream', requireAuth, async (req: AuthRequest, res) => {
    const projectId = Number(req.params.id);
    const isAdmin = req.authUser!.role === 'ADMIN' || req.authUser!.role === 'SUPER_ADMIN';
    const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, isAdmin);
    if (!authorized) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: any) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent({ type: 'connected', projectId, timestamp: new Date().toISOString() });
    const unsubscribe = subscribeToProject(projectId, sendEvent);

    req.on('close', () => {
      unsubscribe();
    });
  });

  app.post('/api/projects/:id/analyze', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, true);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const job = await startBackgroundCrawlJob(projectId, req.authUser!.id, req.body.config);
      res.json({ job });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/projects/:id/pages/selection', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const { selectedPageIds } = req.body as { selectedPageIds: number[] };
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const pages = await db.select().from(projectPages).where(eq(projectPages.projectId, projectId));
      for (const page of pages) {
        const isSelected = selectedPageIds.includes(page.id);
        await db.update(projectPages).set({ selected: isSelected }).where(eq(projectPages.id, page.id));
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects/:id/recreate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const { prompt, operationType } = req.body;
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, true);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const result = await runAIProjectReconstruction(
        projectId,
        req.authUser!.id,
        prompt || '',
        operationType === 'modify' ? 'modify' : 'recreate'
      );
      const updatedDetails = await getProjectFullDetails(projectId);
      res.json({
        result,
        projectDetails: updatedDetails,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'AI reconstruction failed.' });
    }
  });

  app.put('/api/projects/:id/files/:fileId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const fileId = Number(req.params.fileId);
      const { content } = req.body;
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, true);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const [updated] = await db
        .update(generatedFiles)
        .set({
          content,
          sizeBytes: Buffer.byteLength(content || '', 'utf8'),
        })
        .where(and(eq(generatedFiles.id, fileId), eq(generatedFiles.projectId, projectId)))
        .returning();

      res.json({ file: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects/:id/files/:fileId/ai', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const fileId = Number(req.params.fileId);
      const { action, instructions } = req.body as {
        action: 'regenerate' | 'refactor' | 'explain';
        instructions?: string;
      };

      const details = await getProjectFullDetails(projectId);
      if (!details) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const targetFile = details.files.find((f) => f.id === fileId);
      if (!targetFile) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const provider = getActiveAIProvider();
      const projectContext = `Project: ${details.project.name} (${details.project.originalUrl}). Files: ${details.files.map((f) => f.filePath).join(', ')}`;

      const aiRes = await provider.generateSingleFileAction(
        action || 'regenerate',
        targetFile.filePath,
        targetFile.content,
        instructions || '',
        projectContext
      );

      if (action !== 'explain' && aiRes.updatedContent) {
        await db
          .update(generatedFiles)
          .set({
            content: aiRes.updatedContent,
            sizeBytes: Buffer.byteLength(aiRes.updatedContent, 'utf8'),
          })
          .where(eq(generatedFiles.id, fileId));
      }

      await db.insert(aiGenerations).values({
        projectId,
        userId: req.authUser!.id,
        provider: provider.name,
        model: provider.model,
        operationType: `${action}_file`,
        prompt: `${action.toUpperCase()} ${targetFile.filePath}: ${instructions || 'Default optimization'}`,
        responseSummary: aiRes.explanation,
        status: 'completed',
      });

      res.json(aiRes);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'AI file action failed.' });
    }
  });

  app.post('/api/projects/:id/database/generate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const { instructions } = req.body;
      const details = await getProjectFullDetails(projectId);
      if (!details) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const provider = getActiveAIProvider();
      const projectContext = `Project: ${details.project.name}, URL: ${details.project.originalUrl}, Pages: ${details.pages.map((p) => `${p.path} (${p.pageType})`).join(', ')}`;
      const dbResult = await provider.generateDatabaseArchitecture(projectContext, instructions || '');

      if (details.latestVersion) {
        await db
          .update(generatedProjects)
          .set({ databaseSchemaJson: JSON.stringify(dbResult.tables) })
          .where(eq(generatedProjects.id, details.latestVersion.id));

        await db.insert(generatedFiles).values({
          projectId,
          versionId: details.latestVersion.id,
          filePath: `migrations/00${details.versions.length + 1}_ai_schema.sql`,
          language: 'sql',
          content: dbResult.migrationSql,
          sizeBytes: Buffer.byteLength(dbResult.migrationSql, 'utf8'),
        });

        await db.insert(generatedFiles).values({
          projectId,
          versionId: details.latestVersion.id,
          filePath: 'src/db/models.ts',
          language: 'typescript',
          content: dbResult.ormModelsCode,
          sizeBytes: Buffer.byteLength(dbResult.ormModelsCode, 'utf8'),
        });
      }

      await db.insert(aiGenerations).values({
        projectId,
        userId: req.authUser!.id,
        provider: provider.name,
        model: provider.model,
        operationType: 'generate_db',
        prompt: instructions || 'Generate relational PostgreSQL schema & migrations',
        responseSummary: dbResult.explanation,
        status: 'completed',
      });

      const updatedDetails = await getProjectFullDetails(projectId);
      res.json({
        dbResult,
        projectDetails: updatedDetails,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Database schema generation failed.' });
    }
  });

  app.get('/api/projects/:id/versions/:versionId/files', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const versionId = Number(req.params.versionId);
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, true);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const files = await db
        .select()
        .from(generatedFiles)
        .where(and(eq(generatedFiles.projectId, projectId), eq(generatedFiles.versionId, versionId)))
        .orderBy(asc(generatedFiles.filePath));
      res.json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects/:id/versions/:versionId/restore', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const versionId = Number(req.params.versionId);
      const details = await getProjectFullDetails(projectId);
      if (!details) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      const targetVersion = details.versions.find((v) => v.id === versionId);
      if (!targetVersion) {
        return res.status(404).json({ error: 'Version not found.' });
      }
      const sourceFiles = await db
        .select()
        .from(generatedFiles)
        .where(eq(generatedFiles.versionId, versionId));

      const nextVersionNum = (details.versions[0]?.versionNumber || 0) + 1;
      const [restoredVersion] = await db
        .insert(generatedProjects)
        .values({
          projectId,
          versionNumber: nextVersionNum,
          versionLabel: `Version ${nextVersionNum} — Restored from V${targetVersion.versionNumber}`,
          promptUsed: `Rollback to Version ${targetVersion.versionNumber}`,
          framework: targetVersion.framework,
          databaseSchemaJson: targetVersion.databaseSchemaJson,
          previewHtml: targetVersion.previewHtml,
        })
        .returning();

      for (const f of sourceFiles) {
        await db.insert(generatedFiles).values({
          projectId,
          versionId: restoredVersion.id,
          filePath: f.filePath,
          language: f.language,
          content: f.content,
          sizeBytes: f.sizeBytes,
        });
      }

      const updatedDetails = await getProjectFullDetails(projectId);
      res.json({ projectDetails: updatedDetails });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects/:id/duplicate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const details = await getProjectFullDetails(projectId);
      if (!details) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const [copy] = await db
        .insert(projects)
        .values({
          userId: req.authUser!.id,
          name: `${details.project.name} (Copy)`,
          originalUrl: details.project.originalUrl,
          mode: details.project.mode,
          scope: details.project.scope,
          extractionMode: details.project.extractionMode,
          status: details.project.status,
          pagesDiscovered: details.project.pagesDiscovered,
          assetsDiscovered: details.project.assetsDiscovered,
          projectSizeBytes: details.project.projectSizeBytes,
          technologiesJson: details.project.technologiesJson,
          analysisScore: details.project.analysisScore,
          aiStatus: details.project.aiStatus,
          configJson: details.project.configJson,
        })
        .returning();

      for (const p of details.pages) {
        await db.insert(projectPages).values({
          projectId: copy.id,
          url: p.url,
          path: p.path,
          title: p.title,
          pageType: p.pageType,
          statusCode: p.statusCode,
          htmlContent: p.htmlContent,
          metaJson: p.metaJson,
          isAuthUi: p.isAuthUi,
          selected: p.selected,
        });
      }

      for (const a of details.assets) {
        await db.insert(projectAssets).values({
          projectId: copy.id,
          url: a.url,
          localPath: a.localPath,
          assetType: a.assetType,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          statusCode: a.statusCode,
          contentText: a.contentText,
        });
      }

      if (details.analysis) {
        await db.insert(analysisResults).values({
          projectId: copy.id,
          technologiesJson: details.analysis.technologiesJson,
          colorsJson: details.analysis.colorsJson,
          fontsJson: details.analysis.fontsJson,
          navigationJson: details.analysis.navigationJson,
          componentsJson: details.analysis.componentsJson,
          breakpointsJson: details.analysis.breakpointsJson,
          externalResourcesJson: details.analysis.externalResourcesJson,
          recommendationsJson: details.analysis.recommendationsJson,
          summaryReportMd: details.analysis.summaryReportMd,
        });
      }

      if (details.latestVersion) {
        const [vCopy] = await db
          .insert(generatedProjects)
          .values({
            projectId: copy.id,
            versionNumber: 1,
            versionLabel: details.latestVersion.versionLabel,
            promptUsed: details.latestVersion.promptUsed,
            framework: details.latestVersion.framework,
            databaseSchemaJson: details.latestVersion.databaseSchemaJson,
            previewHtml: details.latestVersion.previewHtml,
          })
          .returning();

        for (const f of details.files) {
          await db.insert(generatedFiles).values({
            projectId: copy.id,
            versionId: vCopy.id,
            filePath: f.filePath,
            language: f.language,
            content: f.content,
            sizeBytes: f.sizeBytes,
          });
        }
      }

      res.status(201).json({ project: copy });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to duplicate project.' });
    }
  });

  app.delete('/api/projects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const isAdmin = req.authUser!.role === 'ADMIN' || req.authUser!.role === 'SUPER_ADMIN';
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, isAdmin);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }
      await db.delete(projects).where(eq(projects.id, projectId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/projects/:id/download', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const downloadType = (req.query.type as 'FULL_ZIP' | 'SOURCE_ONLY' | 'ASSETS_ONLY') || 'FULL_ZIP';
      const versionId = req.query.versionId ? Number(req.query.versionId) : undefined;

      const isAdmin = req.authUser!.role === 'ADMIN' || req.authUser!.role === 'SUPER_ADMIN';
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, isAdmin);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const { buffer, fileName } = await buildProjectZipArchive(projectId, req.authUser!.id, downloadType, versionId);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.byteLength.toString());
      res.send(buffer);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to generate ZIP archive.' });
    }
  });

  app.get('/api/projects/:id/report', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const details = await getProjectFullDetails(projectId);
      if (!details || !details.analysis) {
        return res.status(404).json({ error: 'Analysis report not found.' });
      }
      const safeSlug = details.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}-analysis-report.md"`);
      res.send(details.analysis.summaryReportMd);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // GITHUB REPOSITORY CREATION & PROJECT PUSH ROUTES
  // ============================================================================
  app.post('/api/projects/:id/github/create-repo', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const isAdmin = req.authUser!.role === 'ADMIN' || req.authUser!.role === 'SUPER_ADMIN';
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, isAdmin);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found or access denied.' });
      }

      const { name, description, isPrivate } = req.body;
      const repo = await createGithubRepositoryForUser(req.authUser!.id, {
        name: name || authorized.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-'),
        description: description || `Website analyzed and reconstructed from ${authorized.originalUrl} with SiteForge AI`,
        isPrivate: Boolean(isPrivate),
      });

      await db
        .update(projects)
        .set({
          githubConnected: true,
          githubUsername: repo.ownerLogin,
          githubRepositoryName: repo.name,
          githubRepositoryUrl: repo.htmlUrl,
          githubRepositoryId: repo.id,
          githubDefaultBranch: repo.defaultBranch,
        })
        .where(eq(projects.id, projectId));

      const updatedDetails = await getProjectFullDetails(projectId);
      res.status(201).json({
        repository: repo,
        projectDetails: updatedDetails,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create GitHub repository.' });
    }
  });

  app.post('/api/projects/:id/github/push', requireAuth, async (req: AuthRequest, res) => {
    try {
      const projectId = Number(req.params.id);
      const isAdmin = req.authUser!.role === 'ADMIN' || req.authUser!.role === 'SUPER_ADMIN';
      const authorized = await getProjectByIdForUser(projectId, req.authUser!.id, isAdmin);
      if (!authorized) {
        return res.status(404).json({ error: 'Project not found or access denied.' });
      }

      const { createNewRepo, repoName, description, isPrivate, commitMessage } = req.body;
      const pushResult = await pushProjectToGithubRepository(projectId, req.authUser!.id, {
        createNewRepo: Boolean(createNewRepo),
        repoName,
        description,
        isPrivate: Boolean(isPrivate),
        commitMessage,
      });

      const updatedDetails = await getProjectFullDetails(projectId);
      res.json({
        pushResult,
        projectDetails: updatedDetails,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to push project to GitHub.' });
    }
  });

  // ============================================================================
  // JOB CONTROL ROUTES (CANCEL & RETRY)
  // ============================================================================
  app.post('/api/jobs/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const jobId = Number(req.params.id);
      const [job] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, jobId));
      if (!job) {
        return res.status(404).json({ error: 'Job not found.' });
      }
      cancelActiveCrawlJob(jobId);
      await db
        .update(crawlJobs)
        .set({ status: 'cancelled', currentStep: 'Cancelled by user', completedAt: new Date() })
        .where(eq(crawlJobs.id, jobId));
      await db.update(projects).set({ status: 'cancelled' }).where(eq(projects.id, job.projectId));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/jobs/:id/retry', requireAuth, async (req: AuthRequest, res) => {
    try {
      const jobId = Number(req.params.id);
      const [oldJob] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, jobId));
      if (!oldJob) {
        return res.status(404).json({ error: 'Job not found.' });
      }
      const newJob = await startBackgroundCrawlJob(oldJob.projectId, req.authUser!.id);
      res.json({ job: newJob });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================================================
  // ADMIN PANEL ROUTES (PROTECTED BY RBAC)
  // ============================================================================
  app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
      const allJobs = await db.select().from(crawlJobs).orderBy(desc(crawlJobs.createdAt)).limit(50);
      const allAiJobs = await db.select().from(aiGenerations).orderBy(desc(aiGenerations.createdAt)).limit(50);
      const allLogs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
      const settings = await db.select().from(systemSettings);

      const sanitizedUsers = allUsers.map((u) => ({
        id: u.id,
        uid: u.uid,
        email: u.email,
        name: u.name,
        role: u.role,
        plan: u.plan,
        status: u.status,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
      }));

      res.json({
        users: sanitizedUsers,
        projects: allProjects,
        crawlJobs: allJobs,
        aiJobs: allAiJobs,
        auditLogs: allLogs,
        systemSettings: settings,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load admin overview.' });
    }
  });

  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const targetUserId = Number(req.params.id);
      const { status, role, plan } = req.body;
      const patch: Record<string, any> = {};
      if (status) patch.status = status;
      if (role) patch.role = role;
      if (plan) patch.plan = plan;

      const [updated] = await db.update(users).set(patch).where(eq(users.id, targetUserId)).returning();
      await createAuditLog({
        userId: req.authUser!.id,
        action: 'ADMIN_USER_UPDATE',
        status: 'success',
        details: `Updated user #${targetUserId}: ${JSON.stringify(patch)}`,
      });
      res.json({
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          plan: updated.plan,
          status: updated.status,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const targetUserId = Number(req.params.id);
      if (targetUserId === req.authUser!.id) {
        return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
      }
      await db.delete(users).where(eq(users.id, targetUserId));
      await createAuditLog({
        userId: req.authUser!.id,
        action: 'ADMIN_USER_DELETE',
        status: 'success',
        details: `Deleted user #${targetUserId}`,
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/settings', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: 'Setting key is required.' });
      const [setting] = await db
        .insert(systemSettings)
        .values({ key, value: String(value), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: String(value), updatedAt: new Date() },
        })
        .returning();
      res.json({ setting });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // VITE DEV MIDDLEWARE OR STATIC ASSET SERVING
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on ${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err?.message || 'Unknown startup error');
  process.exit(1);
});
