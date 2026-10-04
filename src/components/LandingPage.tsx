import React, { useState } from 'react';
import {
  Globe,
  ArrowRight,
  Code2,
  Cpu,
  Download,
  ShieldCheck,
  Layers,
  ChevronDown,
  GitBranch,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import heroDiagramImg from '../assets/images/hero_architecture_diagram_1791108653499.jpg';
import { PLATFORM_PRESETS, RECONSTRUCTION_PLAYBOOKS } from '../shared/platform-presets.ts';

interface LandingPageProps {
  isAuthenticated: boolean;
  onOpenAnalyzer: (initialUrl: string, presetId?: string) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onNavigateDashboard: () => void;
}

export function ForgeMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="#121218" stroke="#E11D48" strokeWidth="1.5" />
      <path d="M9 11.5H27L23.5 17H12.5L9 11.5Z" fill="#E11D48" />
      <path d="M12.5 20.5H23.5L27 25.5H9L12.5 20.5Z" fill="#F43F5E" fillOpacity="0.85" />
      <circle cx="18" cy="18.75" r="2.2" fill="#FAFAFA" />
    </svg>
  );
}

export function LandingPage({
  isAuthenticated,
  onOpenAnalyzer,
  onOpenAuth,
  onNavigateDashboard,
}: LandingPageProps) {
  const [heroUrl, setHeroUrl] = useState('https://example.com');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [imgError, setImgError] = useState(false);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenAnalyzer(heroUrl);
  };

  const faqs = [
    {
      q: 'How does Site Forge AI transform a public URL into a modern application?',
      a: 'Site Forge AI crawls authorized public routes, extracts design tokens (hex color palettes, typography families, responsive breakpoints), detects the underlying technology stack, and uses an AI reconstruction engine to synthesize modular React + TypeScript + Tailwind CSS components, REST API routes, and PostgreSQL migrations.',
    },
    {
      q: 'Can I push my reconstructed project directly to GitHub?',
      a: 'Yes. Authenticate with Continue with GitHub, create a new public or private repository directly inside your Project Workspace, and commit the entire reconstructed source tree via the GitHub Git Data API with one click.',
    },
    {
      q: 'What security boundaries and SSRF protections are enforced during analysis?',
      a: 'Every URL is validated and resolved via DNS before any HTTP request is dispatched. Requests to localhost, loopback interfaces, private IPv4/IPv6 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), and cloud metadata endpoints (169.254.169.254) are strictly blocked.',
    },
    {
      q: 'How does the platform handle login and authentication screens on analyzed websites?',
      a: 'When the analyzer encounters a login, signup, or password reset route, it flags the page as "Authentication UI detected" and inspects only the publicly accessible layout structure. It never harvests credentials, session cookies, or private user data.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#07070A] text-zinc-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (5 Nav Links) — Zone 3 (2 Primary Actions) */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#07070A]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white font-display whitespace-nowrap">
            <ForgeMark className="w-7 h-7" />
            <span>Site Forge AI</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <a href="#workflow" className="hover:text-white transition-colors whitespace-nowrap">
              Workflow
            </a>
            <a href="#platforms" className="hover:text-white transition-colors whitespace-nowrap">
              Platforms
            </a>
            <a href="#recreation" className="hover:text-white transition-colors whitespace-nowrap">
              AI Rebuild
            </a>
            <a href="#playbooks" className="hover:text-white transition-colors whitespace-nowrap">
              Playbooks
            </a>
            <a href="#pricing" className="hover:text-white transition-colors whitespace-nowrap">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={onNavigateDashboard}
                className="px-4 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-zinc-200 hover:text-white transition-colors whitespace-nowrap"
              >
                Project Workspace
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-xl border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-200 hover:text-white transition-colors whitespace-nowrap"
              >
                Sign In
              </button>
            )}
            <button
              onClick={() => onOpenAnalyzer(heroUrl)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-950/50 transition-colors whitespace-nowrap"
            >
              Analyze Website
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-b border-zinc-800/80 pt-16 pb-24 bg-gradient-to-b from-rose-950/15 via-[#07070A] to-[#07070A]">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-rose-500/30 bg-rose-500/10 text-xs font-mono text-rose-400 mb-5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SITE FORGE AI · WEBSITE ANALYZER & AI RECONSTRUCTION PLATFORM</span>
              </div>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.06] mb-6"
                style={{ textWrap: 'balance' }}
              >
                Analyze. Rebuild. Own Your Code.
              </h1>
              <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl mb-8">
                Inspect any authorized website, decompose its routes, design tokens, and public assets, reconstruct a modern React + Tailwind + PostgreSQL application with AI, and push directly to GitHub.
              </p>

              {/* Central URL Input Bar */}
              <form
                onSubmit={handleHeroSubmit}
                className="p-2 rounded-2xl border border-zinc-800 bg-[#101017]/90 backdrop-blur-md shadow-2xl max-w-2xl mb-6"
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Globe className="w-4 h-4 text-zinc-400 absolute left-4" />
                    <input
                      type="text"
                      value={heroUrl}
                      onChange={(e) => setHeroUrl(e.target.value)}
                      placeholder="https://example.com"
                      aria-label="Target website URL to analyze"
                      className="w-full pl-11 pr-4 py-3.5 bg-transparent text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 transition-colors whitespace-nowrap"
                  >
                    <span>Analyze Website</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onOpenAnalyzer(heroUrl)}
                  className="px-5 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold transition-colors whitespace-nowrap"
                >
                  Recreate Website with AI
                </button>
                <button
                  onClick={() => (isAuthenticated ? onNavigateDashboard() : onOpenAuth('login'))}
                  className="px-5 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-zinc-200 hover:text-white flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <GitBranch className="w-3.5 h-3.5 text-rose-500" />
                  <span>{isAuthenticated ? 'Open Project Workspace' : 'Continue with GitHub'}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-zinc-800 bg-[#101017] overflow-hidden shadow-2xl">
                {!imgError ? (
                  <img
                    src={heroDiagramImg}
                    alt="Site Forge AI architecture engine decomposing web DOM trees into modular React, Tailwind, and PostgreSQL code"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-72 sm:h-80 object-cover"
                  />
                ) : (
                  <div className="w-full h-72 sm:h-80 bg-gradient-to-br from-zinc-900 via-rose-950/30 to-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                    <Layers className="w-10 h-10 text-rose-500 mb-3" />
                    <div className="text-sm font-bold text-white">Site Forge AI Reconstruction Engine</div>
                    <div className="text-xs text-zinc-400 mt-1">DOM AST → Modular React + Tailwind + GitHub Sync</div>
                  </div>
                )}
                <div className="p-4 border-t border-zinc-800/80 bg-[#0A0A0F] flex items-center justify-between text-xs text-zinc-400 font-mono">
                  <span>URL → ANALYZE → AI REBUILD → GITHUB</span>
                  <span className="text-rose-400 font-semibold">FORGE ENGINE v2</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* END-TO-END WORKFLOW PIPELINE */}
        <section id="workflow" className="py-20 border-b border-zinc-800/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <div className="text-xs font-mono text-rose-500 mb-2">SITE FORGE AI WORKFLOW</div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                Complete Pipeline From Public URL to GitHub Repository
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Every stage executes real network inspection, DOM & CSS token extraction, AI code synthesis, binary ZIP packaging, and GitHub Git Data API commits.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                {
                  step: '01',
                  title: 'Analyze Website',
                  desc: 'Enter any authorized URL. Crawler discovers public routes, HTML structure, stylesheets, scripts, SVGs, and fonts.',
                  icon: Globe,
                },
                {
                  step: '02',
                  title: 'Inspect Structure & Design',
                  desc: 'Extracts hex color palettes, typography hierarchies, responsive breakpoints, and technology signatures.',
                  icon: Layers,
                },
                {
                  step: '03',
                  title: 'AI Website Reconstruction',
                  desc: 'Synthesizes clean, modular React + TypeScript + Tailwind components and PostgreSQL database schemas.',
                  icon: Cpu,
                },
                {
                  step: '04',
                  title: 'Project Workspace & Export',
                  desc: 'Preview across desktop, tablet, and mobile viewports, edit source files in the IDE, and export a validated ZIP.',
                  icon: Code2,
                },
                {
                  step: '05',
                  title: 'Push to GitHub',
                  desc: 'Create a new public or private GitHub repository and push the generated project with a single click.',
                  icon: GitBranch,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="p-5 rounded-2xl border border-zinc-800/90 bg-[#101017] flex flex-col justify-between space-y-4 hover:border-rose-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-9 h-9 rounded-xl bg-rose-600/15 border border-rose-500/30 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-rose-500" />
                        </div>
                        <span className="text-xs font-mono text-zinc-500">{item.step}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PLATFORM RECONSTRUCTION PRESETS (TRANSFORMED FROM UPLOADED ARCHIVE) */}
        <section id="platforms" className="py-20 border-b border-zinc-800/80 bg-[#0B0B10]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <div className="text-xs font-mono text-rose-500 mb-2">PLATFORM RECONSTRUCTION PROFILES</div>
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  Analyze & Rebuild Any Web Platform Into Ownable Code
                </h2>
                <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                  Select a platform profile below to pre-configure Site Forge AI's crawler rules, asset extractors, and AI reconstruction engine for that architecture.
                </p>
              </div>
              <button
                onClick={() => onOpenAnalyzer(heroUrl)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white self-start md:self-auto whitespace-nowrap"
              >
                Open Custom URL Analyzer →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLATFORM_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="p-5 rounded-2xl border border-zinc-800/90 bg-[#12121A] flex flex-col justify-between space-y-4 hover:border-rose-500/50 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-white">{preset.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-rose-400">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">{preset.signatureNotes}</p>
                    <div className="text-[11px] font-mono text-zinc-500">
                      Target: {preset.aiRebuildHint}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenAnalyzer(preset.sampleUrl, preset.id)}
                    className="w-full py-2 px-3 rounded-xl border border-zinc-700 hover:border-rose-500 hover:bg-rose-600/15 text-xs font-bold text-zinc-200 hover:text-white flex items-center justify-between transition-colors"
                  >
                    <span>Analyze {preset.name} Site</span>
                    <ArrowRight className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI RECONSTRUCTION STUDIO & GITHUB PUBLISHING */}
        <section id="recreation" className="py-20 border-b border-zinc-800/80">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="text-xs font-mono text-rose-500">AI RECONSTRUCTION & GITHUB STUDIO</div>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Interactive Project Workspace With Live Sandbox & GitHub Sync
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Site Forge AI goes far beyond static file archiving. Once a website is analyzed, open it in the Project Workspace to inspect pages, browse assets, refactor code with AI, generate PostgreSQL schemas, and push directly to GitHub.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  ['Page & Route Tree', 'Inspect status codes, DOM hierarchy, and route classification.'],
                  ['Asset Browser', 'Filter discovered CSS, JS, SVGs, images, and web fonts.'],
                  ['AI Rebuild Studio', 'Prompt AI to modernize layouts, colors, and TypeScript components.'],
                  ['1-Click GitHub Push', 'Create public or private repos and commit generated files via API.'],
                ].map(([title, desc]) => (
                  <div key={title} className="p-4 rounded-xl border border-zinc-800 bg-[#101017]">
                    <div className="text-xs font-bold text-white mb-1">{title}</div>
                    <div className="text-xs text-zinc-400 leading-relaxed">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 rounded-2xl border border-zinc-800 bg-[#101017] p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <ForgeMark className="w-6 h-6" />
                  <div>
                    <div className="text-sm font-bold text-white">Site Forge AI Studio</div>
                    <div className="text-xs text-zinc-400">Live Analysis · AI Reconstruction · GitHub Publisher</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-rose-400">React · Tailwind · PostgreSQL</span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-[#08080C] border border-zinc-800 text-zinc-300 space-y-1.5">
                  <div className="text-zinc-500 text-[11px]">LIVE ANALYSIS PIPELINE</div>
                  <div className="text-emerald-400">✓ Connecting</div>
                  <div className="text-emerald-400">✓ Discovering pages</div>
                  <div className="text-emerald-400">✓ Inspecting HTML & CSS</div>
                  <div className="text-emerald-400">✓ Discovering assets</div>
                  <div className="text-rose-400 font-bold">● AI reconstruction</div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#08080C] border border-zinc-800 text-zinc-300 space-y-1.5">
                  <div className="text-zinc-500 text-[11px]">GENERATED REPOSITORY</div>
                  <div>├── src/App.tsx</div>
                  <div>├── src/components/Header.tsx</div>
                  <div>├── src/db/schema.ts</div>
                  <div>├── migrations/001_init.sql</div>
                  <div className="text-emerald-400">└── ✓ Pushed to GitHub</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200 font-mono">
                "Rebuild this analyzed website into a responsive dark-mode SaaS dashboard with crimson accents and generate PostgreSQL tables."
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-zinc-400">Includes ZIP export & GitHub repository creation</span>
                <button
                  onClick={() => onOpenAnalyzer(heroUrl)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors"
                >
                  Launch Analyzer
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ENGINEERING PLAYBOOKS & GUIDES */}
        <section id="playbooks" className="py-20 border-b border-zinc-800/80 bg-[#0B0B10]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <div className="text-xs font-mono text-rose-500 mb-2">RECONSTRUCTION PLAYBOOKS</div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                Guided Workflows for Code Extraction, Archival & AI Rebuilds
              </h2>
              <p className="text-sm text-zinc-400">
                Execute structured engineering playbooks directly inside Site Forge AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {RECONSTRUCTION_PLAYBOOKS.map((pb) => (
                <div
                  key={pb.id}
                  className="p-6 rounded-2xl border border-zinc-800 bg-[#12121A] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-rose-400 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{pb.category}</span>
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">Mode: {pb.recommendedMode}</span>
                    </div>
                    <h3 className="text-base font-bold text-white">{pb.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{pb.summary}</p>
                    <ol className="space-y-1.5 pt-2 border-t border-zinc-800/80 text-xs text-zinc-300">
                      {pb.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-mono text-rose-500 font-bold">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => onOpenAnalyzer(heroUrl)}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-rose-600 border border-zinc-700 hover:border-rose-500 text-xs font-bold text-white transition-colors"
                    >
                      Run Playbook in Analyzer →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING ARCHITECTURE */}
        <section id="pricing" className="py-20 border-b border-zinc-800/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <div className="text-xs font-mono text-rose-500 mb-2">WORKSPACE PLANS</div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                Built for Solo Developers, Agencies & Enterprise Engineering Teams
              </h2>
              <p className="text-sm text-zinc-400">
                Switch plans anytime inside your workspace settings. Every tier includes real crawling, ZIP exports, and GitHub integration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  tier: 'Free',
                  audience: 'For evaluation & single-site analysis',
                  price: '$0',
                  cadence: 'per month',
                  pages: '500 crawl pages / mo',
                  storage: '100 MB artifact storage',
                  ai: '50 AI reconstructions / mo',
                },
                {
                  tier: 'Pro',
                  audience: 'For full-stack engineers & creators',
                  price: '$29',
                  cadence: 'per month',
                  pages: '10,000 crawl pages / mo',
                  storage: '1 GB artifact storage',
                  ai: '1,000 AI reconstructions / mo',
                  featured: true,
                },
                {
                  tier: 'Business',
                  audience: 'For agencies & migration studios',
                  price: '$99',
                  cadence: 'per month',
                  pages: '50,000 crawl pages / mo',
                  storage: '10 GB artifact storage',
                  ai: '5,000 AI reconstructions / mo',
                },
                {
                  tier: 'Enterprise',
                  audience: 'For large-scale archival & security teams',
                  price: 'Custom',
                  cadence: 'annual contract',
                  pages: '500,000+ crawl pages / mo',
                  storage: '100 GB S3/R2 storage',
                  ai: '50,000+ AI reconstructions / mo',
                },
              ].map((plan) => (
                <div
                  key={plan.tier}
                  className={`p-6 rounded-2xl border flex flex-col justify-between ${
                    plan.featured
                      ? 'border-rose-500 bg-gradient-to-b from-rose-950/25 to-[#101017]'
                      : 'border-zinc-800 bg-[#101017]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-white">{plan.tier}</div>
                      {plan.featured && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-600 text-white font-bold">
                          MOST POPULAR
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1 mb-5">{plan.audience}</div>
                    <div className="flex items-baseline gap-1.5 mb-6 tabular-nums">
                      <span className="text-3xl font-bold text-white font-mono">{plan.price}</span>
                      <span className="text-xs text-zinc-400">{plan.cadence}</span>
                    </div>
                    <div className="space-y-2.5 text-xs text-zinc-300 border-t border-zinc-800 pt-4 font-mono tabular-nums">
                      <div>· {plan.pages}</div>
                      <div>· {plan.storage}</div>
                      <div>· {plan.ai}</div>
                      <div>· GitHub Repo Sync & ZIP Export</div>
                    </div>
                  </div>
                  <button
                    onClick={() => (isAuthenticated ? onNavigateDashboard() : onOpenAuth('signup'))}
                    className={`mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors ${
                      plan.featured
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white'
                    }`}
                  >
                    {isAuthenticated ? 'Manage in Workspace' : `Start with ${plan.tier}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ & SECURITY SECTION */}
        <section id="faq" className="py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqs.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={item.q} className="rounded-2xl border border-zinc-800 bg-[#101017]">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-bold text-white"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs text-zinc-300 leading-relaxed border-t border-zinc-800/60 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800/80 py-8 px-6 text-xs text-zinc-500 bg-[#050508]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ForgeMark className="w-5 h-5" />
            <span>© {new Date().getFullYear()} Site Forge AI. Website Analyzer & AI Reconstruction Studio.</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a href="/api/openapi.json" target="_blank" rel="noreferrer" className="hover:text-zinc-300">
              OpenAPI 3.1
            </a>
            <a href="/health" target="_blank" rel="noreferrer" className="hover:text-zinc-300">
              System Health
            </a>
            <button onClick={() => onOpenAuth('login')} className="hover:text-zinc-300">
              Continue with GitHub
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
