# SiteForge AI — Website Analyzer, Source Code Exporter & AI Reconstruction Platform

**SiteForge AI** is a full-stack developer SaaS platform for analyzing authorized websites, extracting their publicly accessible structure and assets, exporting clean modular source code as validated ZIP archives, and reconstructing or iterating on full-stack applications using AI.

---

## Architecture Overview

1. **Frontend (`src/App.tsx`, `src/components/*`)**:
   - Built with React 19, TypeScript, and Tailwind CSS.
   - Features a dark obsidian developer aesthetic, Top Bar Contract, full SaaS Dashboard, URL Analyzer & Crawl Configurator, Live SSE Crawl Progress & Log Console, Page & Route Selector, IDE Source Code Explorer & Editor, Split-Screen AI Reconstruction Workspace, Live Sandboxed Multi-Device Preview (Desktop / Tablet / Mobile), Side-by-Side Original vs. Recreated Difference View, Visual Database Schema Builder, Version Timeline with Diff & Rollback, and RBAC Admin Panel.

2. **Backend API & Worker (`server.ts`, `src/server/*`)**:
   - Express + Vite server binding to `0.0.0.0:3000`.
   - **SSRF-Protected Crawler (`src/server/crawler.ts`)**: Validates URLs, resolves DNS, blocks private IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`), respects `robots.txt` and crawl depth/page limits, extracts pages/assets/styles/scripts, detects frameworks (`Detected` / `Likely`), sanitizes authentication UI inputs, and streams real-time events over Server-Sent Events (`/api/projects/:id/stream`).
   - **AI Provider Adapter (`src/server/ai-provider.ts`)**: Pluggable `AIProvider` interface supporting `GeminiAIProvider` (`@google/genai` with `gemini-3.8-flash`) and `OpenAICompatibleProvider`. Supports full project reconstruction, conversational versioned modifications, single-file regeneration/refactoring/explanation, and relational database schema + migration generation.
   - **Validated ZIP Builder (`src/server/zip-builder.ts`)**: Uses `JSZip` to package generated source code, assets, migrations, `.env.example`, `README.md`, and `ANALYSIS_REPORT.md` into verified `.zip` archives.

3. **Database (`src/db/schema.ts`, `src/db/index.ts`, `src/db/repository.ts`)**:
   - Powered by **Google Cloud SQL for PostgreSQL** and **Drizzle ORM** using connection pooling (`pg.Pool` Object Method).
   - Includes 17 relational tables (`users`, `sessions`, `projects`, `project_pages`, `project_assets`, `crawl_jobs`, `crawl_events`, `analysis_results`, `generated_projects`, `generated_files`, `ai_generations`, `downloads`, `api_keys`, `subscriptions`, `audit_logs`, `notifications`, `system_settings`).

4. **Authentication & Security (`src/middleware/auth.ts`)**:
   - Supports both **Google Sign-In via Firebase Authentication** (`signInWithPopup` + `firebase-admin` ID token verification) and **Email/Password Authentication** (`bcryptjs` 12-round password hashing, cryptographic session tokens, and single-use SHA-256 hashed password reset tokens).
   - Server-enforced Role-Based Access Control (`USER`, `ADMIN`, `SUPER_ADMIN`).

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run unit & security tests
npm test

# Start full-stack server on port 3000
npm run dev

# Type-check & build for production
npm run lint
npm run build
```
