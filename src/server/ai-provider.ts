import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../db/index.ts';
import {
  projects,
  generatedProjects,
  generatedFiles,
  aiGenerations,
} from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { getProjectFullDetails, createNotification, createAuditLog } from '../db/repository.ts';
import { broadcastProjectEvent } from './crawler.ts';

export interface GeneratedFileSpec {
  filePath: string;
  language: string;
  content: string;
}

export interface DatabaseTableSpec {
  tableName: string;
  description?: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    constraint?: string;
  }[];
}

export interface AIReconstructionResult {
  versionLabel: string;
  summary: string;
  framework: string;
  previewHtml: string;
  files: GeneratedFileSpec[];
  databaseTables: DatabaseTableSpec[];
}

export interface AIProvider {
  name: string;
  model: string;
  generateReconstruction(prompt: string, contextSummary: string): Promise<AIReconstructionResult>;
  generateSingleFileAction(
    action: 'regenerate' | 'refactor' | 'explain',
    filePath: string,
    currentContent: string,
    instructions: string,
    projectContext: string
  ): Promise<{ updatedContent: string; explanation: string }>;
  generateDatabaseArchitecture(
    projectContext: string,
    instructions: string
  ): Promise<{
    tables: DatabaseTableSpec[];
    migrationSql: string;
    ormModelsCode: string;
    explanation: string;
  }>;
}

class GeminiAIProvider implements AIProvider {
  name = 'gemini';
  model: string;

  constructor(model?: string) {
    this.model = model || process.env.AI_MODEL || 'gemini-3.8-flash';
  }

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('AI provider is not configured: GEMINI_API_KEY is missing in environment secrets.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async generateReconstruction(prompt: string, contextSummary: string): Promise<AIReconstructionResult> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `You are the SiteForge AI Reconstruction Engine.
Analyze the following extracted website data and user instructions, and generate a clean, maintainable, modular full-stack React + TypeScript + Tailwind CSS application along with a complete interactive standalone HTML preview (using Tailwind CDN so it renders immediately inside a sandboxed iframe).

WEBSITE ANALYSIS CONTEXT:
${contextSummary}

USER INSTRUCTIONS:
${prompt}

REQUIREMENTS:
1. First perform a source-understanding pass: infer the site's information architecture, route behavior, components, visual system, forms, client-side interactions, data flows, and observable server/backend requirements from the supplied capture.
2. Prioritize high visual and functional fidelity. Do not create a generic SaaS mockup when captured source is available. Reuse the extracted HTML structure, CSS, JavaScript behavior, assets, routes, typography, colors, and interaction patterns as the primary evidence.
3. Reproduce responsive behavior for desktop/tablet/mobile and implement a backend architecture that matches observable workflows (forms, actions, API calls, and persistence needs) as closely as can be inferred from public evidence. Never claim access to private server code that was not captured.
4. Never reject the capture merely because some resources were unavailable. Preserve unavailable resources as documented placeholders and continue reconstructing everything that was successfully captured.
5. Provide a complete, self-contained, interactive \`previewHtml\` document (using <script src="https://cdn.tailwindcss.com"></script> and interactive vanilla JS/state toggles for tabs/modals/drawers) that visually and functionally represents the rebuilt application.
6. Provide modular project source files in \`files\` (including \`src/App.tsx\`, \`src/components/Navbar.tsx\`, \`src/components/Hero.tsx\`, backend/API routes, database migrations, \`README.md\`, \`.env.example\`, and \`package.json\`).
7. Provide a relational PostgreSQL database schema in \`databaseTables\` that supports the observable application behavior rather than a placeholder schema.
8. Do not omit captured routes, source snapshots, assets, or important interactions just to shorten the answer. The final project should remain complete and runnable.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            versionLabel: { type: Type.STRING, description: 'Short version label, e.g., Full-Stack React Reconstruction' },
            summary: { type: Type.STRING, description: 'Concise explanation of architectural changes and components created' },
            framework: { type: Type.STRING, description: 'Target stack name, e.g., React 19 + Tailwind CSS + Express + PostgreSQL' },
            previewHtml: { type: Type.STRING, description: 'Complete standalone HTML5 document with Tailwind CDN for live sandbox preview' },
            files: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  filePath: { type: Type.STRING },
                  language: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['filePath', 'language', 'content'],
              },
            },
            databaseTables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tableName: { type: Type.STRING },
                  description: { type: Type.STRING },
                  columns: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING },
                        nullable: { type: Type.BOOLEAN },
                        constraint: { type: Type.STRING },
                      },
                      required: ['name', 'type', 'nullable'],
                    },
                  },
                },
                required: ['tableName', 'columns'],
              },
            },
          },
          required: ['versionLabel', 'summary', 'framework', 'previewHtml', 'files', 'databaseTables'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('AI provider returned an empty response.');
    }
    return JSON.parse(text.trim()) as AIReconstructionResult;
  }

  async generateSingleFileAction(
    action: 'regenerate' | 'refactor' | 'explain',
    filePath: string,
    currentContent: string,
    instructions: string,
    projectContext: string
  ): Promise<{ updatedContent: string; explanation: string }> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `You are the SiteForge AI Code Architect.
Operation: ${action.toUpperCase()}
Target File: ${filePath}
Project Context: ${projectContext}
User Instructions: ${instructions || `Perform ${action} on ${filePath} for maximum maintainability, accessibility, and type safety.`}

Current File Content:
\`\`\`
${currentContent}
\`\`\`

If operation is 'explain', return the unchanged \`currentContent\` in \`updatedContent\` and a detailed architectural explanation in \`explanation\`.
If operation is 'regenerate' or 'refactor', return the complete improved production source code in \`updatedContent\` and a summary of improvements in \`explanation\`.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            updatedContent: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ['updatedContent', 'explanation'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('AI provider returned an empty response for file operation.');
    }
    return JSON.parse(text.trim());
  }

  async generateDatabaseArchitecture(
    projectContext: string,
    instructions: string
  ): Promise<{
    tables: DatabaseTableSpec[];
    migrationSql: string;
    ormModelsCode: string;
    explanation: string;
  }> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `You are a Principal PostgreSQL Database Architect for SiteForge AI.
Based on the analyzed website structure and user requirements below, design a production-grade PostgreSQL relational schema, complete SQL migration file (with foreign keys, indexes, constraints), and Drizzle ORM TypeScript model definitions.

Project Context:
${projectContext}

Additional Requirements:
${instructions || 'Design tables for users, sessions, core domain entities, audit logs, and role-based access control.'}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            migrationSql: { type: Type.STRING },
            ormModelsCode: { type: Type.STRING },
            tables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tableName: { type: Type.STRING },
                  description: { type: Type.STRING },
                  columns: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING },
                        nullable: { type: Type.BOOLEAN },
                        constraint: { type: Type.STRING },
                      },
                      required: ['name', 'type', 'nullable'],
                    },
                  },
                },
                required: ['tableName', 'columns'],
              },
            },
          },
          required: ['explanation', 'migrationSql', 'ormModelsCode', 'tables'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('AI provider returned an empty response for database generation.');
    }
    return JSON.parse(text.trim());
  }
}

class OpenAICompatibleProvider implements AIProvider {
  name = 'openai_compatible';
  model: string;
  endpoint: string;
  apiKey: string;

  constructor() {
    this.model = process.env.AI_MODEL || 'gpt-4o';
    this.endpoint = process.env.OPENAI_COMPATIBLE_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    this.apiKey = process.env.OPENAI_COMPATIBLE_API_KEY || '';
  }

  private ensureConfigured() {
    if (!this.apiKey) {
      throw new Error('OpenAI-Compatible provider is selected but OPENAI_COMPATIBLE_API_KEY is not configured.');
    }
  }

  async generateReconstruction(prompt: string, contextSummary: string): Promise<AIReconstructionResult> {
    this.ensureConfigured();
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Return JSON with keys: versionLabel, summary, framework, previewHtml, files (array of {filePath, language, content}), databaseTables (array of {tableName, description, columns}).',
          },
          { role: 'user', content: `Context:\n${contextSummary}\n\nInstructions:\n${prompt}` },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI-Compatible provider returned HTTP ${res.status}`);
    }
    const data: any = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }

  async generateSingleFileAction(
    action: 'regenerate' | 'refactor' | 'explain',
    filePath: string,
    currentContent: string,
    instructions: string,
    projectContext: string
  ): Promise<{ updatedContent: string; explanation: string }> {
    this.ensureConfigured();
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return JSON with keys: updatedContent, explanation.' },
          { role: 'user', content: `${action} on ${filePath}. Context: ${projectContext}. Instructions: ${instructions}\n\n${currentContent}` },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI-Compatible provider returned HTTP ${res.status}`);
    }
    const data: any = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }

  async generateDatabaseArchitecture(projectContext: string, instructions: string) {
    this.ensureConfigured();
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return JSON with keys: explanation, migrationSql, ormModelsCode, tables.' },
          { role: 'user', content: `Context: ${projectContext}\nInstructions: ${instructions}` },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI-Compatible provider returned HTTP ${res.status}`);
    }
    const data: any = await res.json();
    return JSON.parse(data.choices[0].message.content);
  }
}

export function getActiveAIProvider(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (providerType === 'openai_compatible') {
    return new OpenAICompatibleProvider();
  }
  return new GeminiAIProvider(process.env.AI_MODEL);
}

export async function runAIProjectReconstruction(
  projectId: number,
  userId: number,
  userInstructions: string,
  operationType: 'recreate' | 'modify' = 'recreate'
) {
  const startTime = Date.now();
  const details = await getProjectFullDetails(projectId);
  if (!details) {
    throw new Error('Project not found.');
  }

  const provider = getActiveAIProvider();

  await db
    .update(projects)
    .set({ aiStatus: 'reconstructing' })
    .where(eq(projects.id, projectId));

  broadcastProjectEvent(projectId, {
    type: 'ai_progress',
    status: 'reconstructing',
    message: operationType === 'recreate' ? 'AI Reconstruction Engine is rebuilding the project...' : 'AI is applying your modifications and creating a new version...',
  });

  try {
    const selectedPages = details.pages.filter((p) => p.selected);
    const pagesToUse = selectedPages.length > 0 ? selectedPages : details.pages;

    // Give the reconstruction model substantially more of the actual capture instead of a tiny HTML snippet.
    // Binary assets are represented by their local path/metadata; text assets are included when practical.
    // This keeps the ZIP complete while giving the AI the source context it needs to avoid generic mockups.
    const sourceFilesForAI = details.files.map((f) => ({
      path: f.filePath,
      language: f.language,
      content: f.content.slice(0, 50000),
    }));
    const assetContext = details.assets.map((a) => ({
      url: a.url,
      localPath: a.localPath,
      assetType: a.assetType,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      text: a.contentText ? a.contentText.slice(0, 12000) : undefined,
    }));
    const contextSummary = JSON.stringify(
      {
        projectName: details.project.name,
        originalUrl: details.project.originalUrl,
        instruction: 'Treat this capture as the source of truth. Do not replace it with a generic template. Preserve every available route, asset reference, style token, interaction signal, and extracted source file unless a user explicitly asks for a change.',
        discoveredPages: pagesToUse.map((p) => ({
          path: p.path,
          title: p.title,
          pageType: p.pageType,
          isAuthUi: p.isAuthUi,
          meta: p.metaJson,
          fullHtml: p.htmlContent.slice(0, 60000),
        })),
        assets: assetContext,
        analysis: details.analysis
          ? {
              technologies: JSON.parse(details.analysis.technologiesJson || '[]'),
              colors: JSON.parse(details.analysis.colorsJson || '[]'),
              fonts: JSON.parse(details.analysis.fontsJson || '[]'),
              navigation: JSON.parse(details.analysis.navigationJson || '[]'),
              components: JSON.parse(details.analysis.componentsJson || '[]'),
              breakpoints: JSON.parse(details.analysis.breakpointsJson || '[]'),
              externalResources: JSON.parse(details.analysis.externalResourcesJson || '[]'),
            }
          : null,
        existingVersionNumber: details.latestVersion?.versionNumber || 1,
        existingFiles: sourceFilesForAI,
        currentPreview: details.latestVersion?.previewHtml?.slice(0, 30000) || '',
      },
      null,
      2
    );

    const effectivePrompt =
      userInstructions.trim() ||
      'Reconstruct this website as a modern, responsive, accessible full-stack React + TypeScript + Tailwind CSS application with modular components, interactive navigation, clean typography, and PostgreSQL schema.';

    const result = await provider.generateReconstruction(effectivePrompt, contextSummary);

    const nextVersionNumber = (details.versions[0]?.versionNumber || 0) + 1;
    const [newVersion] = await db
      .insert(generatedProjects)
      .values({
        projectId,
        versionNumber: nextVersionNumber,
        versionLabel: `Version ${nextVersionNumber} — ${result.versionLabel || (operationType === 'recreate' ? 'AI Full Reconstruction' : 'AI Modification')}`,
        promptUsed: effectivePrompt,
        framework: result.framework || 'React 19 + Tailwind CSS + Express + PostgreSQL',
        databaseSchemaJson: JSON.stringify(result.databaseTables || []),
        previewHtml: result.previewHtml,
      })
      .returning();

    // Preserve previous files that weren't overwritten and insert all new/updated files
    const newFilePaths = new Set((result.files || []).map((f) => f.filePath));
    const mergedFiles: GeneratedFileSpec[] = [...(result.files || [])];

    for (const prevFile of details.files) {
      if (!newFilePaths.has(prevFile.filePath)) {
        mergedFiles.push({
          filePath: prevFile.filePath,
          language: prevFile.language,
          content: prevFile.content,
        });
      }
    }

    for (const f of mergedFiles) {
      await db.insert(generatedFiles).values({
        projectId,
        versionId: newVersion.id,
        filePath: f.filePath,
        language: f.language || 'typescript',
        content: f.content,
        sizeBytes: Buffer.byteLength(f.content, 'utf8'),
      });
    }

    const durationMs = Date.now() - startTime;
    await db.insert(aiGenerations).values({
      projectId,
      userId,
      provider: provider.name,
      model: provider.model,
      operationType,
      prompt: effectivePrompt,
      responseSummary: result.summary,
      status: 'completed',
      durationMs,
    });

    await db
      .update(projects)
      .set({ aiStatus: 'ready', status: 'completed', lastAnalysisAt: new Date() })
      .where(eq(projects.id, projectId));

    broadcastProjectEvent(projectId, {
      type: 'ai_progress',
      status: 'ready',
      versionNumber: nextVersionNumber,
      message: result.summary,
    });

    await createNotification(
      userId,
      operationType === 'recreate' ? 'AI Recreation Completed' : `Version ${nextVersionNumber} Created`,
      result.summary,
      'success'
    );

    await createAuditLog({
      userId,
      projectId,
      action: `AI_${operationType.toUpperCase()}`,
      status: 'success',
      durationMs,
      details: `Created Version ${nextVersionNumber}: ${result.versionLabel}`,
    });

    return {
      version: newVersion,
      summary: result.summary,
    };
  } catch (error: any) {
    await db
      .update(projects)
      .set({ aiStatus: 'failed' })
      .where(eq(projects.id, projectId));

    broadcastProjectEvent(projectId, {
      type: 'ai_progress',
      status: 'failed',
      message: error.message || 'AI reconstruction failed.',
    });

    throw error;
  }
}
