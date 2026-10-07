import crypto from 'crypto';
import { db } from '../db/index.ts';
import { users, projects } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { getProjectFullDetails, createNotification, createAuditLog } from '../db/repository.ts';
import { broadcastProjectEvent } from './crawler.ts';

// AES-256-GCM encryption for GitHub OAuth access tokens at rest
function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || 'siteforge_production_session_secret_change_me';
  return crypto.scryptSync(secret, 'siteforge_github_token_salt_v1', 32);
}

export function encryptGithubToken(plainToken: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptGithubToken(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Stored GitHub token format is invalid.');
  }
  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function getGithubConfig() {
  const clientId = (process.env.GITHUB_CLIENT_ID || process.env.GITHUB_APP_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_APP_CLIENT_SECRET || '').trim();
  const callbackUrl = (process.env.GITHUB_CALLBACK_URL || '').trim();
  const appId = (process.env.GITHUB_APP_ID || '').trim();

  const isConfigured = Boolean(
    clientId &&
      clientSecret &&
      clientId !== 'YOUR_GITHUB_CLIENT_ID' &&
      clientSecret !== 'YOUR_GITHUB_CLIENT_SECRET'
  );

  return {
    clientId,
    clientSecret,
    callbackUrl,
    appId,
    isConfigured,
  };
}

// CSRF State Store with 10-minute TTL
interface OAuthStateEntry {
  userId?: number;
  redirectUri: string;
  createdAt: number;
}
const oauthStateStore = new Map<string, OAuthStateEntry>();

export function createOAuthState(redirectUri: string, userId?: number): string {
  // Clean expired states
  const now = Date.now();
  for (const [k, v] of oauthStateStore.entries()) {
    if (now - v.createdAt > 10 * 60 * 1000) {
      oauthStateStore.delete(k);
    }
  }
  const state = crypto.randomBytes(24).toString('hex');
  oauthStateStore.set(state, { userId, redirectUri, createdAt: now });
  return state;
}

export function consumeOAuthState(state: string): OAuthStateEntry | null {
  const entry = oauthStateStore.get(state);
  if (!entry) return null;
  oauthStateStore.delete(state);
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) {
    return null;
  }
  return entry;
}

export function resolveGithubCallbackUrl(clientOrigin?: string): string {
  const cfg = getGithubConfig();
  if (cfg.callbackUrl && cfg.callbackUrl.startsWith('http')) {
    return cfg.callbackUrl;
  }
  const appUrl = (process.env.APP_URL || '').trim();
  if (appUrl && appUrl.startsWith('http') && appUrl !== 'MY_APP_URL') {
    return `${appUrl.replace(/\/$/, '')}/auth/github/callback`;
  }
  if (clientOrigin && clientOrigin.startsWith('http')) {
    return `${clientOrigin.replace(/\/$/, '')}/auth/github/callback`;
  }
  return 'http://localhost:3000/auth/github/callback';
}

export function buildGithubAuthorizeUrl(clientOrigin?: string, userId?: number): { url: string; state: string; redirectUri: string } {
  const cfg = getGithubConfig();
  if (!cfg.isConfigured) {
    throw new Error('GitHub integration is not configured.');
  }
  const redirectUri = resolveGithubCallbackUrl(clientOrigin);
  const state = createOAuthState(redirectUri, userId);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email repo',
    state,
  });

  return {
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    state,
    redirectUri,
  };
}

export async function exchangeGithubCodeForToken(code: string, redirectUri: string): Promise<{ accessToken: string; scope: string }> {
  const cfg = getGithubConfig();
  if (!cfg.isConfigured) {
    throw new Error('GitHub integration is not configured.');
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'SiteForge-AI-Platform',
    },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub OAuth token exchange failed with HTTP ${res.status}.`);
  }

  const data: any = await res.json();
  if (data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub did not return an access token.');
  }

  return {
    accessToken: data.access_token,
    scope: data.scope || 'read:user,user:email,repo',
  };
}

export interface GithubProfile {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export async function fetchGithubUserProfile(accessToken: string): Promise<GithubProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SiteForge-AI-Platform',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) {
    if (userRes.status === 401) {
      throw new Error('GitHub authorization expired or invalid.');
    }
    throw new Error(`GitHub API error (${userRes.status}) while fetching user profile.`);
  }
  const userData: any = await userRes.json();

  let primaryEmail = userData.email || '';
  if (!primaryEmail) {
    try {
      const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
      if (emailsRes.ok) {
        const emails: any[] = await emailsRes.json();
        const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
        if (primary?.email) {
          primaryEmail = primary.email;
        }
      }
    } catch {
      // Fallback if user:email scope is unavailable
    }
  }

  if (!primaryEmail) {
    primaryEmail = `${userData.login}@users.noreply.github.com`;
  }

  return {
    id: String(userData.id),
    login: userData.login,
    name: userData.name || userData.login,
    email: primaryEmail.toLowerCase().trim(),
    avatarUrl: userData.avatar_url || '',
  };
}

export function validateRepositoryName(name: string): { valid: boolean; error?: string } {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Repository name cannot be empty.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Repository name cannot exceed 100 characters.' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid repository name: Only alphanumeric characters, hyphens (-), underscores (_), and periods (.) are allowed.',
    };
  }
  if (trimmed.startsWith('.') || trimmed.endsWith('.') || trimmed === '..') {
    return { valid: false, error: 'Invalid repository name: Cannot start or end with a period.' };
  }
  return { valid: true };
}

async function getUserDecryptedGithubToken(userId: number): Promise<{ token: string; username: string }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.githubConnected || !user.githubTokenEncrypted) {
    throw new Error('GitHub account is not connected. Please connect your GitHub account first.');
  }
  const token = decryptGithubToken(user.githubTokenEncrypted);
  return {
    token,
    username: user.githubUsername || '',
  };
}

export interface GithubRepoInfo {
  id: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
  ownerLogin: string;
}

export async function createGithubRepositoryForUser(
  userId: number,
  options: {
    name: string;
    description?: string;
    isPrivate: boolean;
  }
): Promise<GithubRepoInfo> {
  const validation = validateRepositoryName(options.name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { token } = await getUserDecryptedGithubToken(userId);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'SiteForge-AI-Platform',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: options.name.trim(),
      description: options.description || 'Website analyzed and reconstructed with SiteForge AI',
      private: Boolean(options.isPrivate),
      auto_init: true,
    }),
  });

  if (!res.ok) {
    let errBody: any = {};
    try {
      errBody = await res.json();
    } catch {
      // ignore
    }
    if (res.status === 401) {
      throw new Error('GitHub authorization expired. Please reconnect your GitHub account in Settings.');
    }
    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        throw new Error('GitHub API rate limit reached. Please wait a few minutes and try again.');
      }
      throw new Error('Insufficient permissions to create a repository. Ensure repository access is authorized.');
    }
    if (res.status === 422) {
      const details = errBody.errors?.map((e: any) => e.message).join(', ') || '';
      if (details.toLowerCase().includes('already exists') || errBody.message?.toLowerCase().includes('already exists')) {
        throw new Error(`Repository "${options.name.trim()}" already exists in your GitHub account.`);
      }
      throw new Error(`Invalid repository parameters: ${details || errBody.message || 'Unprocessable entity'}`);
    }
    throw new Error(errBody.message || `GitHub API returned HTTP ${res.status} while creating repository.`);
  }

  const repo: any = await res.json();
  return {
    id: String(repo.id),
    name: repo.name,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch || 'main',
    private: Boolean(repo.private),
    ownerLogin: repo.owner?.login || '',
  };
}

export async function pushProjectToGithubRepository(
  projectId: number,
  userId: number,
  options: {
    createNewRepo?: boolean;
    repoName?: string;
    description?: string;
    isPrivate?: boolean;
    commitMessage?: string;
  }
): Promise<{
  repositoryUrl: string;
  repositoryName: string;
  branch: string;
  commitSha: string;
  commitUrl: string;
  filesUploaded: number;
}> {
  const startTime = Date.now();
  const details = await getProjectFullDetails(projectId);
  if (!details) {
    throw new Error('Project not found.');
  }

  const { token, username } = await getUserDecryptedGithubToken(userId);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'SiteForge-AI-Platform',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const emitProgress = (step: string, message: string) => {
    broadcastProjectEvent(projectId, {
      type: 'github_progress',
      step,
      message,
      timestamp: new Date().toISOString(),
    });
  };

  try {
    await db
      .update(projects)
      .set({ githubSyncStatus: 'syncing' })
      .where(eq(projects.id, projectId));

    emitProgress('preparing', 'Preparing files...');

    // Gather all project files (generated source files + standalone preview + analysis report + text assets)
    const filesToPush = new Map<string, string>();
    for (const f of details.files) {
      const cleanPath = f.filePath.replace(/^\/+/, '');
      if (cleanPath) {
        filesToPush.set(cleanPath, f.content);
      }
    }

    if (details.latestVersion?.previewHtml) {
      filesToPush.set('preview/standalone-preview.html', details.latestVersion.previewHtml);
    }
    if (details.analysis?.summaryReportMd) {
      filesToPush.set('ANALYSIS_REPORT.md', details.analysis.summaryReportMd);
    }

    for (const asset of details.assets) {
      if (asset.contentText && !asset.contentText.includes('External resource unreachable')) {
        const cleanAssetPath = asset.localPath.replace(/^\/+/, '');
        if (cleanAssetPath && !filesToPush.has(cleanAssetPath)) {
          filesToPush.set(cleanAssetPath, asset.contentText);
        }
      }
    }

    if (filesToPush.size === 0) {
      throw new Error('No generated files available to push. Run website analysis or AI reconstruction first.');
    }

    let owner = details.project.githubUsername || username;
    let repoName = details.project.githubRepositoryName || '';
    let repoUrl = details.project.githubRepositoryUrl || '';
    let repoId = details.project.githubRepositoryId || '';
    let defaultBranch = details.project.githubDefaultBranch || 'main';

    if (options.createNewRepo || !repoName) {
      const targetName = (options.repoName || details.project.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-')).trim();
      emitProgress('creating_repo', `Creating GitHub repository "${targetName}"...`);
      const createdRepo = await createGithubRepositoryForUser(userId, {
        name: targetName,
        description: options.description || `Reconstructed from ${details.project.originalUrl} with SiteForge AI`,
        isPrivate: Boolean(options.isPrivate),
      });
      owner = createdRepo.ownerLogin || username;
      repoName = createdRepo.name;
      repoUrl = createdRepo.htmlUrl;
      repoId = createdRepo.id;
      defaultBranch = createdRepo.defaultBranch || 'main';
    }

    emitProgress('comparing', 'Comparing files and resolving branch reference...');

    // 1. Get latest commit SHA on defaultBranch
    let refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`, {
      headers,
    });

    // If repository was just created or empty and ref isn't ready yet, initialize via Contents API
    if (refRes.status === 404 || refRes.status === 409) {
      const readmeContent = filesToPush.get('README.md') || `# ${repoName}\n\nGenerated with SiteForge AI.`;
      await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/README.md`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: 'Initial repository setup via SiteForge AI',
          content: Buffer.from(readmeContent, 'utf8').toString('base64'),
          branch: defaultBranch,
        }),
      });
      refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`, {
        headers,
      });
    }

    if (!refRes.ok) {
      const errJson: any = await refRes.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to read branch "${defaultBranch}" on ${owner}/${repoName} (HTTP ${refRes.status}).`);
    }

    const refData: any = await refRes.json();
    const latestCommitSha: string = refData.object.sha;

    // 2. Get base tree SHA from latest commit
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${latestCommitSha}`, {
      headers,
    });
    if (!commitRes.ok) {
      throw new Error(`Failed to fetch base commit details from GitHub (HTTP ${commitRes.status}).`);
    }
    const commitData: any = await commitRes.json();
    const baseTreeSha: string = commitData.tree.sha;

    emitProgress('uploading', `Uploading ${filesToPush.size} project files to GitHub Git Tree...`);

    // 3. Create Git tree containing all project files in a single batch call
    const treeItems = Array.from(filesToPush.entries()).map(([filePath, content]) => ({
      path: filePath,
      mode: '100644',
      type: 'blob',
      content,
    }));

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    });

    if (!treeRes.ok) {
      const errJson: any = await treeRes.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to create Git tree on GitHub (HTTP ${treeRes.status}).`);
    }
    const treeData: any = await treeRes.json();

    emitProgress('committing', 'Creating commit...');

    // 4. Create commit pointing to new tree
    const commitMessage =
      (options.commitMessage || '').trim() ||
      (options.createNewRepo
        ? `Initial commit: Reconstructed project from SiteForge AI (${filesToPush.size} files)`
        : 'Update generated website from SiteForge AI');

    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    });

    if (!newCommitRes.ok) {
      const errJson: any = await newCommitRes.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to create Git commit on GitHub (HTTP ${newCommitRes.status}).`);
    }
    const newCommitData: any = await newCommitRes.json();
    const newCommitSha: string = newCommitData.sha;
    const commitHtmlUrl = newCommitData.html_url || `${repoUrl}/commit/${newCommitSha}`;

    // 5. Update branch reference to point to the new commit
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
          force: false,
        }),
      }
    );

    if (!updateRefRes.ok) {
      const errJson: any = await updateRefRes.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to update branch reference on GitHub (HTTP ${updateRefRes.status}).`);
    }

    // 6. Persist GitHub sync metadata on the project
    await db
      .update(projects)
      .set({
        githubConnected: true,
        githubUsername: owner,
        githubRepositoryName: repoName,
        githubRepositoryUrl: repoUrl,
        githubRepositoryId: repoId,
        githubDefaultBranch: defaultBranch,
        lastGithubCommit: newCommitSha,
        lastGithubCommitUrl: commitHtmlUrl,
        lastGithubPush: new Date(),
        githubSyncStatus: 'synced',
      })
      .where(eq(projects.id, projectId));

    emitProgress('complete', 'Complete.');

    await createNotification(
      userId,
      'Pushed Project to GitHub',
      `Committed ${filesToPush.size} files to ${owner}/${repoName} (${defaultBranch})`,
      'success'
    );

    await createAuditLog({
      userId,
      projectId,
      action: options.createNewRepo ? 'GITHUB_REPO_CREATE_AND_PUSH' : 'GITHUB_PROJECT_RESYNC',
      status: 'success',
      durationMs: Date.now() - startTime,
      details: `Pushed ${filesToPush.size} files to ${repoUrl} (commit ${newCommitSha.slice(0, 7)})`,
    });

    return {
      repositoryUrl: repoUrl,
      repositoryName: `${owner}/${repoName}`,
      branch: defaultBranch,
      commitSha: newCommitSha,
      commitUrl: commitHtmlUrl,
      filesUploaded: filesToPush.size,
    };
  } catch (error: any) {
    await db
      .update(projects)
      .set({ githubSyncStatus: 'failed' })
      .where(eq(projects.id, projectId));

    emitProgress('failed', error.message || 'GitHub push failed.');
    throw error;
  }
}

export async function disconnectGithubForUser(userId: number) {
  await db
    .update(users)
    .set({
      githubConnected: false,
      githubTokenEncrypted: null,
      githubScopes: null,
    })
    .where(eq(users.id, userId));

  await createAuditLog({
    userId,
    action: 'GITHUB_DISCONNECTED',
    status: 'success',
    details: 'User disconnected GitHub OAuth credentials and cleared encrypted token at rest.',
  });
}
