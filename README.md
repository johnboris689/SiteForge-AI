# SiteForge AI — Website Analyzer, Source Code Exporter, AI Reconstruction & GitHub Sync Platform

**SiteForge AI** is a production-grade full-stack developer SaaS platform for analyzing authorized websites, extracting their publicly accessible structure and assets, exporting clean modular source code, reconstructing full-stack applications with AI, and pushing generated repositories directly to **GitHub**.

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons
- **Backend**: Express 4 + Node.js (`tsx server.ts`) listening on `0.0.0.0:$PORT`
- **Database**: PostgreSQL + Drizzle ORM (`src/db/schema.ts`) with automatic non-destructive startup schema verification (`ensureDatabaseSchema()`)
- **Authentication**: GitHub-first OAuth 2.0 (`Continue with GitHub`) with AES-256-GCM encrypted token storage at rest, plus bcrypt-hashed email/password and single-use reset tokens
- **GitHub Integration**: Real GitHub REST & Git Data API integration (`src/server/github.ts`) supporting 1-click repository creation (public/private), multi-file Git tree commits, branch reference updates, and subsequent resync commits
- **Website Crawler & Analyzer**: Real HTTP fetcher + Cheerio DOM parser + DNS SSRF protection (`src/server/crawler.ts`)
- **AI Reconstruction Engine**: Pluggable `AIProvider` adapter (`src/server/ai-provider.ts`) powered by `@google/genai` (`gemini-3.8-flash`)
- **Archive & Export Engine**: Validated `.zip` package generator using `JSZip` (`src/server/zip-builder.ts`)

---

## Render Production Deployment

This repository includes a production `render.yaml` blueprint configured as a **Render Web Service** + **Render PostgreSQL** database:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/health`
- **Readiness Check Path**: `/ready`
- **Host / Port Binding**: `0.0.0.0:$PORT`

### Required Environment Variables

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) |
| `SESSION_SECRET` | Secret used for session hashing and AES-256-GCM GitHub token encryption at rest |
| `GEMINI_API_KEY` | Google Gemini API key for AI website reconstruction and code refactoring |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `GITHUB_CALLBACK_URL` | Optional explicit callback URL (`https://<your-domain>/auth/github/callback`) |
| `APP_URL` | Public application URL used to resolve OAuth callbacks when an explicit callback is not supplied |
| `OPENAI_COMPATIBLE_ENDPOINT` | Optional OpenAI-compatible chat completion endpoint when `AI_PROVIDER=openai_compatible` |
| `OPENAI_COMPATIBLE_API_KEY` | Optional server-side API key for the OpenAI-compatible provider |

---

## Local Development & Verification

```bash
npm install
npm run lint
npm test
npm run build
npm run start
```

### Product workflow

After authentication the application is intentionally focused on two workspaces: **AI Creation** and **GitHub Publish**. AI Creation uses the real crawler, captured local assets, AI reconstruction/versioning, isolated preview, code review, ZIP export, conversational modifications, and an explicit approval gate. GitHub Publish uses the connected GitHub OAuth identity to list repositories/branches, create repositories, create Git trees/commits, update branches, and return the real repository/commit URLs.

Uploaded source files, images, and ZIP archives are treated as untrusted input. ZIP files are inspected for source text only; uploaded scripts are never executed and uploaded packages are never installed.
