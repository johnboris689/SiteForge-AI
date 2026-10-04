import { db } from './index.ts';
import {
  users,
  sessions,
  projects,
  projectPages,
  projectAssets,
  crawlJobs,
  crawlEvents,
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
} from './schema.ts';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function getOrCreateFirebaseUser(uid: string, email: string, name?: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const isSuperAdmin = normalizedEmail === 'talkdavidjohn@gmail.com';
    const existingByEmail = await db.select().from(users).where(eq(users.email, normalizedEmail));
    if (existingByEmail.length > 0) {
      const current = existingByEmail[0];
      const updated = await db
        .update(users)
        .set({
          uid,
          role: isSuperAdmin ? 'SUPER_ADMIN' : current.role,
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated[0];
    }

    const allUsers = await db.select({ id: users.id }).from(users).limit(1);
    const initialRole = isSuperAdmin || allUsers.length === 0 ? 'SUPER_ADMIN' : 'USER';

    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        role: initialRole,
        plan: 'Pro',
        status: 'active',
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
        },
      })
      .returning();

    const user = result[0];
    const subExisting = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
    if (subExisting.length === 0) {
      await db.insert(subscriptions).values({
        userId: user.id,
        tier: 'Pro',
        status: 'active',
        crawlPagesLimit: 10000,
        storageLimitBytes: 1073741824,
        aiGenerationsLimit: 1000,
      });
    }
    return user;
  } catch (error) {
    console.error('Database error in getOrCreateFirebaseUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getOrCreateGithubUser(params: {
  githubId: string;
  githubUsername: string;
  email: string;
  name: string;
  avatarUrl: string;
  encryptedToken: string;
  scopes: string;
  existingUserId?: number;
}) {
  try {
    const normalizedEmail = params.email.toLowerCase().trim();
    const isSuperAdmin = normalizedEmail === 'talkdavidjohn@gmail.com';

    // If connecting GitHub to an already logged-in user session
    if (params.existingUserId) {
      const [updated] = await db
        .update(users)
        .set({
          githubId: params.githubId,
          githubUsername: params.githubUsername,
          githubAvatarUrl: params.avatarUrl,
          githubConnected: true,
          githubTokenEncrypted: params.encryptedToken,
          githubScopes: params.scopes,
          githubConnectedAt: new Date(),
        })
        .where(eq(users.id, params.existingUserId))
        .returning();
      return updated;
    }

    // Check if user already exists by githubId or email
    const existingByGithub = await db.select().from(users).where(eq(users.githubId, params.githubId));
    if (existingByGithub.length > 0) {
      const current = existingByGithub[0];
      const [updated] = await db
        .update(users)
        .set({
          githubUsername: params.githubUsername,
          githubAvatarUrl: params.avatarUrl,
          githubConnected: true,
          githubTokenEncrypted: params.encryptedToken,
          githubScopes: params.scopes,
          githubConnectedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated;
    }

    const existingByEmail = await db.select().from(users).where(eq(users.email, normalizedEmail));
    if (existingByEmail.length > 0) {
      const current = existingByEmail[0];
      const [updated] = await db
        .update(users)
        .set({
          githubId: params.githubId,
          githubUsername: params.githubUsername,
          githubAvatarUrl: params.avatarUrl,
          githubConnected: true,
          githubTokenEncrypted: params.encryptedToken,
          githubScopes: params.scopes,
          githubConnectedAt: new Date(),
          role: isSuperAdmin ? 'SUPER_ADMIN' : current.role,
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated;
    }

    const allUsers = await db.select({ id: users.id }).from(users).limit(1);
    const initialRole = isSuperAdmin || allUsers.length === 0 ? 'SUPER_ADMIN' : 'USER';

    const [created] = await db
      .insert(users)
      .values({
        uid: `github_${params.githubId}`,
        email: normalizedEmail,
        name: params.name || params.githubUsername,
        role: initialRole,
        plan: 'Pro',
        status: 'active',
        emailVerified: true,
        githubId: params.githubId,
        githubUsername: params.githubUsername,
        githubAvatarUrl: params.avatarUrl,
        githubConnected: true,
        githubTokenEncrypted: params.encryptedToken,
        githubScopes: params.scopes,
        githubConnectedAt: new Date(),
      })
      .returning();

    await db.insert(subscriptions).values({
      userId: created.id,
      tier: 'Pro',
      status: 'active',
      crawlPagesLimit: 10000,
      storageLimitBytes: 1073741824,
      aiGenerationsLimit: 1000,
    });

    await createNotification(
      created.id,
      'GitHub Account Connected',
      `Authenticated as @${params.githubUsername}. You can now create repositories and push reconstructed projects directly to GitHub.`,
      'success'
    );

    return created;
  } catch (error: any) {
    console.error('Database error in getOrCreateGithubUser:', error);
    throw new Error(error.message || 'Failed to synchronize GitHub user account.', { cause: error });
  }
}

export async function createLocalUser(email: string, name: string, passwordHash: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length > 0) {
      throw new Error('An account with this email already exists.');
    }

    const allUsers = await db.select({ id: users.id }).from(users).limit(1);
    const isSuperAdmin = normalizedEmail === 'talkdavidjohn@gmail.com' || allUsers.length === 0;
    const uid = `local_${crypto.randomUUID()}`;

    const [user] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        name: name.trim() || normalizedEmail.split('@')[0],
        passwordHash,
        role: isSuperAdmin ? 'SUPER_ADMIN' : 'USER',
        plan: 'Pro',
        status: 'active',
        emailVerified: true,
      })
      .returning();

    await db.insert(subscriptions).values({
      userId: user.id,
      tier: 'Pro',
      status: 'active',
      crawlPagesLimit: 10000,
      storageLimitBytes: 1073741824,
      aiGenerationsLimit: 1000,
    });

    await createNotification(
      user.id,
      'Welcome to SiteForge AI',
      'Your workspace is active and ready to analyze and reconstruct websites.',
      'success'
    );

    return user;
  } catch (error: any) {
    console.error('Database error in createLocalUser:', error);
    throw new Error(error.message || 'Failed to create user account.', { cause: error });
  }
}

export async function getUserByEmail(email: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const rows = await db.select().from(users).where(eq(users.email, normalizedEmail));
    return rows[0] || null;
  } catch (error) {
    console.error('Database error in getUserByEmail:', error);
    throw new Error('Failed to query user by email.', { cause: error });
  }
}

export async function getUserById(id: number) {
  try {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0] || null;
  } catch (error) {
    console.error('Database error in getUserById:', error);
    throw new Error('Failed to query user by ID.', { cause: error });
  }
}

export async function createSession(userId: number): Promise<string> {
  try {
    const rawToken = `sf_sess_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
    await db.insert(sessions).values({
      userId,
      tokenHash,
      expiresAt,
    });
    return rawToken;
  } catch (error) {
    console.error('Database error in createSession:', error);
    throw new Error('Failed to create authentication session.', { cause: error });
  }
}

export async function getSessionUser(rawToken: string) {
  try {
    const tokenHash = hashToken(rawToken);
    const rows = await db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash));

    if (rows.length === 0) return null;
    const { session, user } = rows[0];
    if (new Date(session.expiresAt) < new Date()) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
      return null;
    }
    return user;
  } catch (error) {
    console.error('Database error in getSessionUser:', error);
    throw new Error('Failed to validate session.', { cause: error });
  }
}

export async function deleteSessionByToken(rawToken: string) {
  try {
    const tokenHash = hashToken(rawToken);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  } catch (error) {
    console.error('Database error in deleteSessionByToken:', error);
  }
}

export async function setResetToken(userId: number, rawResetToken: string) {
  try {
    const resetTokenHash = hashToken(rawResetToken);
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db
      .update(users)
      .set({ resetTokenHash, resetTokenExpiresAt })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('Database error in setResetToken:', error);
    throw new Error('Failed to save password reset token.', { cause: error });
  }
}

export async function consumeResetTokenAndSetPassword(rawResetToken: string, newPasswordHash: string) {
  try {
    const tokenHash = hashToken(rawResetToken);
    const rows = await db.select().from(users).where(eq(users.resetTokenHash, tokenHash));
    if (rows.length === 0) {
      throw new Error('Invalid or expired password reset token.');
    }
    const user = rows[0];
    if (!user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      throw new Error('Password reset token has expired.');
    }
    const [updated] = await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      })
      .where(eq(users.id, user.id))
      .returning();

    await createNotification(
      user.id,
      'Password Successfully Changed',
      'Your account password was reset using a single-use security token.',
      'info'
    );
    return updated;
  } catch (error: any) {
    console.error('Database error in consumeResetTokenAndSetPassword:', error);
    throw new Error(error.message || 'Failed to reset password.', { cause: error });
  }
}

export async function createAuditLog(params: {
  userId?: number | null;
  projectId?: number | null;
  jobId?: number | null;
  action: string;
  status?: string;
  durationMs?: number;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      projectId: params.projectId ?? null,
      jobId: params.jobId ?? null,
      action: params.action,
      status: params.status || 'success',
      durationMs: params.durationMs || 0,
      details: params.details || '',
      ipAddress: params.ipAddress || '127.0.0.1',
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export async function createNotification(userId: number, title: string, message: string, type = 'info') {
  try {
    const [notif] = await db
      .insert(notifications)
      .values({ userId, title, message, type, isRead: false })
      .returning();
    return notif;
  } catch (error) {
    console.error('Notification error:', error);
    return null;
  }
}

export async function getUserProjects(userId: number) {
  try {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt));
  } catch (error) {
    console.error('Database error in getUserProjects:', error);
    throw new Error('Failed to load projects.', { cause: error });
  }
}

export async function getProjectByIdForUser(projectId: number, userId: number, isAdmin = false) {
  try {
    const rows = await db.select().from(projects).where(eq(projects.id, projectId));
    if (rows.length === 0) return null;
    const project = rows[0];
    if (project.userId !== userId && !isAdmin) return null;
    return project;
  } catch (error) {
    console.error('Database error in getProjectByIdForUser:', error);
    throw new Error('Failed to fetch project details.', { cause: error });
  }
}

export async function getProjectFullDetails(projectId: number) {
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return null;

    const pages = await db
      .select()
      .from(projectPages)
      .where(eq(projectPages.projectId, projectId))
      .orderBy(asc(projectPages.id));

    const assets = await db
      .select()
      .from(projectAssets)
      .where(eq(projectAssets.projectId, projectId))
      .orderBy(asc(projectAssets.id));

    const jobs = await db
      .select()
      .from(crawlJobs)
      .where(eq(crawlJobs.projectId, projectId))
      .orderBy(desc(crawlJobs.createdAt));

    const events = await db
      .select()
      .from(crawlEvents)
      .where(eq(crawlEvents.projectId, projectId))
      .orderBy(asc(crawlEvents.id));

    const [analysis] = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.projectId, projectId))
      .orderBy(desc(analysisResults.createdAt));

    const versions = await db
      .select()
      .from(generatedProjects)
      .where(eq(generatedProjects.projectId, projectId))
      .orderBy(desc(generatedProjects.versionNumber));

    const latestVersion = versions[0] || null;
    const files = latestVersion
      ? await db
          .select()
          .from(generatedFiles)
          .where(eq(generatedFiles.versionId, latestVersion.id))
          .orderBy(asc(generatedFiles.filePath))
      : [];

    const aiHistory = await db
      .select()
      .from(aiGenerations)
      .where(eq(aiGenerations.projectId, projectId))
      .orderBy(desc(aiGenerations.createdAt));

    return {
      project,
      pages,
      assets,
      jobs,
      events,
      analysis: analysis || null,
      versions,
      latestVersion,
      files,
      aiHistory,
    };
  } catch (error) {
    console.error('Database error in getProjectFullDetails:', error);
    throw new Error('Failed to load complete project state.', { cause: error });
  }
}
