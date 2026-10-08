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
Analyze the extracted website data and user instructions below and generate a clean, maintainable, modular full-stack React + TypeScript + Tailwind CSS application plus a complete interactive standalone HTML preview.

WEBSITE ANALYSIS CONTEXT:
${contextSummary}

USER INSTRUCTIONS:
${prompt}

REQUIREMENTS:
1. First perform a source-understanding pass over the captured HTML, CSS, JavaScript, assets, routes, typography, design tokens, responsive breakpoints, interactions, and observable backend behavior.
2. Visual fidelity is a hard requirement. Treat the captured website as the source of truth. Do not substitute a generic SaaS layout or invented theme.
3. Preserve exact captured colors and gradients, typography families/weights, font sizes, line heights, container widths, grid/flex structure, gaps, padding, margins, borders, radii, shadows, backgrounds, image ratios, button dimensions, section order, header/footer structure, and responsive breakpoints whenever those values are present in the source.
4. Preserve the source spacing hierarchy and unusual layout behavior instead of normalizing it into a generic modern design.
5. Reuse captured assets, logos, images, fonts, CSS rules, HTML semantics, routes, and observable JavaScript interactions as the primary evidence. When an exact source CSS value is available, prefer it over Tailwind defaults.
6. Reproduce responsive behavior for desktop/tablet/mobile from the captured breakpoints and layout rules. Do not invent breakpoints when source evidence exists.
7. The standalone previewHtml must use the same visual system and structure as the generated project files. It is a faithful visual representation, not a separate mockup.
8. Preserve observable functionality and infer backend architecture only from public evidence. Never claim access to private server code that was not captured.
9. Never reject a capture because some resources were unavailable. Preserve unavailable resources as documented placeholders and continue reconstructing everything successfully captured.
10. Return complete runnable project files, including the actual entry point/components, backend/API routes where observable, database migrations/schema, README.md, .env.example, and package.json.
11. Return a PostgreSQL schema that supports the observable application behavior rather than a placeholder schema.
12. Do not omit captured routes, source snapshots, assets, styles, or important interactions merely to shorten the result.
13. Before returning the result, internally compare the generated structure and preview against the supplied HTML/CSS context and correct mismatches in colors, spacing, typography, dimensions, section ordering, and responsive behavior.
`,
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
            content: 'You are the SiteForge AI Reconstruction Engine. Return JSON with keys: versionLabel, summary, framework, previewHtml, files (array of {filePath, language, content}), databaseTables (array of {tableName, description, columns}). The captured website HTML/CSS/assets are the source of truth. Visual fidelity is mandatory: preserve exact source colors, typography, spacing, dimensions, container widths, gaps, borders, radii, shadows, section structure, assets, and responsive breakpoints whenever they are present in the capture. Do not replace the source with a generic SaaS template. The previewHtml must use the same visual system and structure as the generated project files and should be treated as a faithful visual representation, not a mockup. Never reject partially unavailable captures; reconstruct everything successfully captured and document only what cannot be reproduced.',
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
      'Reconstruct the analyzed website with maximum source fidelity. Treat the captured HTML, CSS, assets, typography, colors, spacing, dimensions, layout structure, interactions, and responsive breakpoints as the source of truth. Match the original visual design and page structure rather than inventing a generic template. Produce a complete responsive full-stack React + TypeScript + Tailwind CSS implementation and make the standalone preview visually match the same reconstruction.';

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
