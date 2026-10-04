import { CrawlConfig, DEFAULT_CRAWL_CONFIG } from './types.ts';

export interface PlatformPreset {
  id: string;
  name: string;
  category: 'Visual Builder' | 'CMS & Commerce' | 'Docs & Publishing' | 'No-Code App';
  defaultMode: 'DOWNLOAD' | 'ANALYZE' | 'RECREATE' | 'PAGE_ONLY';
  sampleUrl: string;
  signatureNotes: string;
  aiRebuildHint: string;
  configOverrides: Partial<CrawlConfig>;
}

export interface ReconstructionPlaybook {
  id: string;
  title: string;
  category: string;
  summary: string;
  steps: string[];
  recommendedMode: 'DOWNLOAD' | 'ANALYZE' | 'RECREATE' | 'PAGE_ONLY';
}

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: 'framer',
    name: 'Framer',
    category: 'Visual Builder',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://framer.com',
    signatureNotes: 'Detects Framer motion layers, responsive breakpoint stacks, and custom web fonts.',
    aiRebuildHint: 'Convert Framer layout stacks into clean Tailwind CSS flex/grid components with smooth motion transitions.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 10,
      maxDepth: 2,
      followExternalAssets: true,
    },
  },
  {
    id: 'webflow',
    name: 'Webflow',
    category: 'Visual Builder',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://webflow.com',
    signatureNotes: 'Extracts data-wf-site, data-wf-page, interactions, and global Webflow style tokens.',
    aiRebuildHint: 'Refactor Webflow w-layout-grid and combo classes into semantic React + Tailwind components.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 12,
      maxDepth: 2,
      followExternalAssets: true,
    },
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'CMS & Commerce',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://shopify.com',
    signatureNotes: 'Analyzes Liquid storefront templates, product grid schemas, and CDN media assets.',
    aiRebuildHint: 'Reconstruct storefront catalog, product detail drawer, and cart state using React + PostgreSQL schema.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'DEEP_ANALYSIS',
      maxPages: 12,
      maxDepth: 2,
      followExternalAssets: true,
    },
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    category: 'CMS & Commerce',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://wordpress.org',
    signatureNotes: 'Identifies wp-content themes, Gutenberg block structures, and REST API endpoints.',
    aiRebuildHint: 'Migrate legacy PHP/WordPress theme templates into a fast, modern React SPA with clean typography.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'DEEP_ANALYSIS',
      maxPages: 10,
      maxDepth: 2,
    },
  },
  {
    id: 'notion',
    name: 'Notion Sites',
    category: 'Docs & Publishing',
    defaultMode: 'ANALYZE',
    sampleUrl: 'https://notion.so',
    signatureNotes: 'Parses callout blocks, nested toggle trees, database tables, and documentation hierarchy.',
    aiRebuildHint: 'Rebuild documentation hierarchy into a searchable knowledge base with sidebar navigation.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'FRONTEND_ANALYSIS',
      maxPages: 10,
      maxDepth: 3,
    },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    category: 'Docs & Publishing',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://ghost.org',
    signatureNotes: 'Extracts editorial article layouts, author cards, newsletter CTAs, and Koenig cards.',
    aiRebuildHint: 'Generate an editorial publication platform with article routing and newsletter signup components.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 10,
      maxDepth: 2,
    },
  },
  {
    id: 'squarespace',
    name: 'Squarespace',
    category: 'Visual Builder',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://squarespace.com',
    signatureNotes: 'Extracts Fluid Engine grid sections, gallery lightboxes, and custom serif/sans font pairings.',
    aiRebuildHint: 'Rebuild portfolio and editorial sections into responsive Tailwind CSS grid components.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 8,
      maxDepth: 2,
    },
  },
  {
    id: 'wix',
    name: 'Wix Studio',
    category: 'Visual Builder',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://wix.com',
    signatureNotes: 'Decomposes Wix thunderbolt containers and absolute-positioned strips into responsive flex layouts.',
    aiRebuildHint: 'Convert deeply nested container divs into clean, accessible React components.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 8,
      maxDepth: 2,
    },
  },
  {
    id: 'bubble',
    name: 'Bubble',
    category: 'No-Code App',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://bubble.io',
    signatureNotes: 'Inspects interactive SaaS workflows, repeating groups, forms, and dashboard views.',
    aiRebuildHint: 'Reconstruct no-code Bubble views into a typed React + Express + PostgreSQL full-stack application.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 10,
      maxDepth: 2,
    },
  },
  {
    id: 'carrd',
    name: 'Carrd',
    category: 'Visual Builder',
    defaultMode: 'PAGE_ONLY',
    sampleUrl: 'https://carrd.co',
    signatureNotes: 'Captures single-page landing sections, anchor navigation, and compact vector assets.',
    aiRebuildHint: 'Rebuild single-page landing layout into a high-converting React landing page component.',
    configOverrides: {
      scope: 'SINGLE_PAGE',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 1,
      maxDepth: 0,
    },
  },
  {
    id: 'softr',
    name: 'Softr',
    category: 'No-Code App',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://softr.io',
    signatureNotes: 'Detects directory grids, client portal blocks, and filterable list views.',
    aiRebuildHint: 'Generate a full-stack directory and client portal with Drizzle PostgreSQL tables.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 8,
      maxDepth: 2,
    },
  },
  {
    id: 'tilda',
    name: 'Tilda',
    category: 'Visual Builder',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://tilda.cc',
    signatureNotes: 'Extracts Zero Block editorial layouts, SVG animations, and typography tokens.',
    aiRebuildHint: 'Transform Zero Block artboards into responsive CSS Grid and React components.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'DEEP_ANALYSIS',
      maxPages: 8,
      maxDepth: 2,
    },
  },
  {
    id: 'readymag',
    name: 'Readymag',
    category: 'Visual Builder',
    defaultMode: 'ANALYZE',
    sampleUrl: 'https://readymag.com',
    signatureNotes: 'Captures editorial micro-interactions, custom webfonts, and magazine-style layouts.',
    aiRebuildHint: 'Reconstruct editorial storytelling layout with modern responsive typography.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'DEEP_ANALYSIS',
      maxPages: 6,
      maxDepth: 2,
    },
  },
  {
    id: 'cargo',
    name: 'Cargo',
    category: 'Visual Builder',
    defaultMode: 'ANALYZE',
    sampleUrl: 'https://cargo.site',
    signatureNotes: 'Extracts brutalist/creative grid layouts, image galleries, and custom CSS variables.',
    aiRebuildHint: 'Preserve minimalist creative grid proportions in a modular React portfolio.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'FRONTEND_ANALYSIS',
      maxPages: 8,
      maxDepth: 2,
    },
  },
  {
    id: 'duda',
    name: 'Duda',
    category: 'CMS & Commerce',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://duda.co',
    signatureNotes: 'Extracts agency multi-page navigation, service cards, and contact lead structures.',
    aiRebuildHint: 'Rebuild multi-page business site into a modular React + Tailwind codebase.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 10,
      maxDepth: 2,
    },
  },
  {
    id: 'dorik',
    name: 'Dorik',
    category: 'Visual Builder',
    defaultMode: 'RECREATE',
    sampleUrl: 'https://dorik.com',
    signatureNotes: 'Extracts clean SaaS landing blocks, pricing tables, and feature grids.',
    aiRebuildHint: 'Convert landing blocks into reusable TypeScript UI components.',
    configOverrides: {
      scope: 'SAME_DOMAIN',
      extractionMode: 'AI_RECONSTRUCTION',
      maxPages: 8,
      maxDepth: 2,
    },
  },
];

export const RECONSTRUCTION_PLAYBOOKS: ReconstructionPlaybook[] = [
  {
    id: 'export-html-css-js',
    title: 'Export Clean HTML, CSS, JS & React Source Tree',
    category: 'Source Extraction',
    summary:
      'Crawl an authorized website, extract all public stylesheets, scripts, and media, and synthesize a clean React + TypeScript + Vite repository.',
    steps: [
      'Enter the target URL in the Site Forge AI Analyzer and select Mode B (Analyze) or Mode C (Recreate).',
      'Enable HTML, CSS, JavaScript, SVG, and Web Fonts in the Asset Extraction filters.',
      'Inspect the generated modular file tree in the Project Workspace Code Explorer and click Download Project ZIP or Push to GitHub.',
    ],
    recommendedMode: 'RECREATE',
  },
  {
    id: 'website-to-github',
    title: 'Analyze, Rebuild & Push Directly to a GitHub Repository',
    category: 'GitHub Workflow',
    summary:
      'Transform any public web property you own into a version-controlled GitHub repository with a single commit via the GitHub Git Data API.',
    steps: [
      'Authenticate using Continue with GitHub to authorize repository creation.',
      'Run website analysis and optional AI Reconstruction to generate modular components and SQL migrations.',
      'Click Push to GitHub in the Project Workspace, choose Public or Private visibility, and commit all files.',
    ],
    recommendedMode: 'RECREATE',
  },
  {
    id: 'archive-before-shutdown',
    title: 'Full Archival & Migration Before Legacy Platform Shutdown',
    category: 'Migration & Archival',
    summary:
      'Preserve every public route, stylesheet, vector icon, font, and structural report before decommissioning a legacy CMS or hosting provider.',
    steps: [
      'Select Mode A (Download) with Same-Domain scope and configure Max Pages and Crawl Depth.',
      'Verify discovered pages and HTTP status codes in the live crawl log.',
      'Export the Complete Project ZIP containing both raw snapshots, reconstructed source, and ANALYSIS_REPORT.md.',
    ],
    recommendedMode: 'DOWNLOAD',
  },
  {
    id: 'template-modernization',
    title: 'Rebuild Visual Builder Templates (Framer, Webflow, Wix) into Ownable Code',
    category: 'AI Reconstruction',
    summary:
      'Eliminate recurring no-code platform lock-in by analyzing your visual builder site and reconstructing it into self-hosted React + Tailwind + PostgreSQL.',
    steps: [
      'Pick the matching Platform Preset (Framer, Webflow, Squarespace, or Wix) in the Website Analyzer.',
      'Review extracted hex color tokens, typography families, and responsive breakpoints in the Analysis tab.',
      'Use the AI Reconstruction Studio to refine components, generate a Drizzle PostgreSQL schema, and deploy to Render.',
    ],
    recommendedMode: 'RECREATE',
  },
];

export function mergePresetWithConfig(preset: PlatformPreset): CrawlConfig {
  return {
    ...DEFAULT_CRAWL_CONFIG,
    ...preset.configOverrides,
    assets: {
      ...DEFAULT_CRAWL_CONFIG.assets,
      ...(preset.configOverrides.assets || {}),
    },
  };
}
