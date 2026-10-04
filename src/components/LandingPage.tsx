import React, { useState } from 'react';
import {
  Globe,
  ArrowRight,
  Code2,
  Cpu,
  Download,
  ShieldCheck,
  Layers,
  Terminal,
  Database,
  ChevronDown,
  FolderGit2,
  Sparkles,
} from 'lucide-react';
import heroDiagramImg from '../assets/images/hero_architecture_diagram_1791108653499.jpg';

interface LandingPageProps {
  isAuthenticated: boolean;
  onOpenAnalyzer: (initialUrl: string) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onNavigateDashboard: () => void;
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
      q: 'How does SiteForge AI differ from traditional static website copiers like HTTrack?',
      a: 'Traditional copiers dump raw, minified HTML and broken relative scripts into a folder. SiteForge AI crawls authorized public resources, extracts design tokens (color palettes, typography, breakpoints), detects the underlying framework, and uses an AI reconstruction engine to generate clean, maintainable React + TypeScript + Tailwind CSS components, REST API routes, and PostgreSQL migrations.',
    },
    {
      q: 'What security boundaries and SSRF protections are enforced during crawling?',
      a: 'Every URL is validated and resolved via DNS before any HTTP request is dispatched. Requests to localhost, loopback interfaces, private IPv4/IPv6 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), and cloud metadata endpoints (169.254.169.254) are strictly blocked.',
    },
    {
      q: 'How does the platform handle login and authentication pages on analyzed websites?',
      a: 'When the crawler encounters a login, signup, or password reset page, it flags the route as "Authentication UI detected" and analyzes only the publicly accessible layout structure. It never harvests credentials, session cookies, or private backend data.',
    },
    {
      q: 'Can I edit the generated source code, compare versions, and export a standalone ZIP?',
      a: 'Yes. Every project includes a full browser IDE with syntax-highlighted source files, single-file AI refactoring, version history with rollback, a sandboxed multi-device live preview, and a validated ZIP archive generator.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (5 Nav Links) — Zone 3 (2 Primary Actions) */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#090D16]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="#top" className="text-xl font-bold tracking-tight text-white font-display whitespace-nowrap">
            SiteForge AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap">
              How It Works
            </a>
            <a href="#analyzer" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap">
              Analyzer
            </a>
            <a href="#recreation" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap">
              AI Rebuild
            </a>
            <a href="#security" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap">
              Security
            </a>
            <a href="#pricing" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={onNavigateDashboard}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-200 hover:text-white transition-colors whitespace-nowrap"
              >
                View Projects
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
              >
                View Projects
              </button>
            )}
            <button
              onClick={() => onOpenAnalyzer(heroUrl)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              Analyze a Website
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-b border-slate-800/80 pt-16 pb-24">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="text-xs font-mono text-indigo-400 mb-4">
                Website Analyzer · Source Exporter · AI Full-Stack Reconstruction
              </div>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-6"
                style={{ textWrap: 'balance' }}
              >
                Analyze. Rebuild. Own Your Code.
              </h1>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mb-8">
                Analyze authorized websites, extract their public structure and assets, generate downloadable source code, and use AI to rebuild the experience as a modern application.
              </p>

              {/* Central URL Input Bar */}
              <form
                onSubmit={handleHeroSubmit}
                className="p-2 rounded-xl border border-slate-800 bg-[#0F1624] shadow-2xl max-w-2xl mb-6"
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3.5" />
                    <input
                      type="text"
                      value={heroUrl}
                      onChange={(e) => setHeroUrl(e.target.value)}
                      placeholder="https://example.com"
                      aria-label="Target website URL to analyze"
                      className="w-full pl-10 pr-4 py-3 bg-transparent text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>Analyze a Website</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onOpenAnalyzer(heroUrl)}
                  className="px-5 py-2.5 rounded-lg bg-white text-slate-950 hover:bg-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Analyze a Website
                </button>
                <button
                  onClick={() => (isAuthenticated ? onNavigateDashboard() : onOpenAuth('login'))}
                  className="px-5 py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-200 hover:text-white transition-colors whitespace-nowrap"
                >
                  View Projects
                </button>
                <div className="text-xs text-slate-400 font-mono">
                  SSRF Protected · Real-Time SSE Crawler · Validated ZIP Export
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-xl border border-slate-800 bg-[#0F1624] overflow-hidden shadow-2xl">
                {!imgError ? (
                  <img
                    src={heroDiagramImg}
                    alt="Isometric diagram of SiteForge AI decomposing web DOM structures into modular React and PostgreSQL architecture"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-72 sm:h-80 object-cover"
                  />
                ) : (
                  <div className="w-full h-72 sm:h-80 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
                    <Layers className="w-10 h-10 text-indigo-400 mb-3" />
                    <div className="text-sm font-semibold text-white">SiteForge Reconstruction Engine</div>
                    <div className="text-xs text-slate-400 mt-1">DOM AST → Modular React + Tailwind + PostgreSQL</div>
                  </div>
                )}
                <div className="p-4 border-t border-slate-800/80 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>PIPELINE: CRAWLER → AST → AI → ZIP</span>
                  <span className="text-emerald-400">PRODUCTION READY</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="py-20 border-b border-slate-800/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <div className="text-xs font-mono text-indigo-400 mb-2">WORKFLOW ARCHITECTURE</div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                From Public URL to Maintainable Full-Stack Codebase
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Every stage executes real network crawling, AST parsing, Gemini 3.8 code synthesis, and binary ZIP validation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  num: '01. Live Authorized Crawl',
                  desc: 'Validates DNS & SSRF boundaries, respects robots.txt, and streams live page & asset extraction over Server-Sent Events.',
                  icon: Globe,
                },
                {
                  num: '02. Deep Stack Analysis',
                  desc: 'Detects frameworks (React, Next.js, Vue, Tailwind, WordPress), extracts hex color palettes, typography, and classifies routes.',
                  icon: Layers,
                },
                {
                  num: '03. AI Reconstruction',
                  desc: 'Converts raw DOM structures into reusable React + TypeScript components, responsive layouts, and PostgreSQL schemas.',
                  icon: Cpu,
                },
                {
                  num: '04. IDE & Validated ZIP',
                  desc: 'Inspect and edit files in the browser code explorer, compare versions side-by-side, preview across viewports, and export ZIP.',
                  icon: Download,
                },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.num} className="p-6 rounded-xl border border-slate-800 bg-[#0D1320]">
                    <Icon className="w-5 h-5 text-indigo-400 mb-4" />
                    <h3 className="text-base font-semibold text-white mb-2">{step.num}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* WEBSITE ANALYZER & AI RECREATION */}
        <section id="analyzer" className="py-20 border-b border-slate-800/80 bg-[#0B101B]">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-mono text-indigo-400 mb-2">FOUR EXTRACTION & REBUILD MODES</div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
                Precision Control Over Every Route and Asset
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Whether you are migrating a legacy marketing site, auditing frontend architecture, or rebuilding a single dashboard screen into React components, SiteForge AI adapts to your workflow.
              </p>

              <div className="space-y-4">
                {[
                  {
                    title: 'Mode A — Static & Source Download',
                    detail: 'Packages discovered HTML, stylesheets, scripts, vectors, and assets into a structured archive.',
                  },
                  {
                    title: 'Mode B — Deep Structural Analysis',
                    detail: 'Produces a comprehensive breakdown of routes, frameworks, CSS tokens, breakpoints, and external dependencies.',
                  },
                  {
                    title: 'Mode C — AI Full-Stack Recreation',
                    detail: 'Synthesizes modular React components, state hooks, Express API routes, and Drizzle/PostgreSQL migrations.',
                  },
                  {
                    title: 'Mode D — Page-Only Selective Extraction',
                    detail: 'Target individual routes such as Pricing, Landing, Documentation, or sanitized Authentication UI layouts.',
                  },
                ].map((item) => (
                  <div key={item.title} className="p-4 rounded-lg border border-slate-800 bg-[#0F1624]">
                    <div className="text-sm font-semibold text-white mb-1">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div id="recreation" className="rounded-xl border border-slate-800 bg-[#0F1624] p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="text-sm font-bold text-white">AI Reconstruction Workspace</div>
                  <div className="text-xs text-slate-400">Split-screen analysis, code explorer & sandboxed preview</div>
                </div>
                <span className="text-xs font-mono text-indigo-400">React · Tailwind · PostgreSQL</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  <div className="text-slate-500 mb-1">Extracted Structure</div>
                  <div>├── src/components/Navbar.tsx</div>
                  <div>├── src/components/Hero.tsx</div>
                  <div>├── src/components/DashboardLayout.tsx</div>
                  <div>├── src/db/models.ts</div>
                  <div>└── migrations/001_initial.sql</div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-indigo-200">
                  <div className="text-indigo-400 mb-1">Interactive AI Prompt</div>
                  <div>"Make the dashboard sidebar collapsible, update the primary accent to crimson, and generate PostgreSQL tables for user projects."</div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Every modification creates a restorable version</span>
                <button
                  onClick={() => onOpenAnalyzer(heroUrl)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                >
                  Launch Workspace
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SUPPORTED TECHNOLOGIES & SECURITY */}
        <section id="security" className="py-20 border-b border-slate-800/80">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-6">
              <div className="text-xs font-mono text-emerald-400 mb-2">SECURITY & ACCEPTABLE USE</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Built for Authorized Engineering, Migrations & Audits
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                SiteForge AI enforces strict technical safeguards so teams can safely audit, back up, and modernize web properties they own or have permission to test.
              </p>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">SSRF & Private Network Blocking:</strong> Automatically resolves DNS and rejects loopback, RFC1918 private networks, and cloud metadata endpoints.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Credential & Cookie Isolation:</strong> Never captures visitor passwords, session tokens, or MFA inputs. Authentication routes are sanitized for UI layout reconstruction only.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Sandboxed Preview Execution:</strong> Reconstructed applications render inside isolated iframe sandboxes without host execution access.
                  </span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6">
              <div className="text-xs font-mono text-indigo-400 mb-2">TECHNOLOGY SIGNATURE ENGINE</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Supported Source & Target Technologies
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Our analyzer inspects DOM markers, script bundles, CSS rules, and HTTP headers, labeling each signature clearly as <span className="text-white font-mono">Detected</span> or <span className="text-white font-mono">Likely</span>.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                {[
                  'React / Next.js',
                  'Vue / Nuxt',
                  'Angular',
                  'Svelte / SvelteKit',
                  'Tailwind CSS',
                  'Bootstrap',
                  'WordPress',
                  'Shopify',
                  'Webflow / Framer',
                  'Wix',
                  'PostgreSQL / Drizzle',
                  'Cloudflare / Vercel',
                ].map((tech) => (
                  <div
                    key={tech}
                    className="px-3.5 py-2.5 rounded-lg border border-slate-800 bg-[#0D1320] text-slate-200"
                  >
                    {tech}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PRICING ARCHITECTURE */}
        <section id="pricing" className="py-20 border-b border-slate-800/80 bg-[#0B101B]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <div className="text-xs font-mono text-indigo-400 mb-2">TRANSPARENT SCALING</div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                Plans Built for Individual Engineers and Enterprise Teams
              </h2>
              <p className="text-sm text-slate-400">
                No artificial daily lockouts. Upgrade or switch tiers anytime from your workspace billing settings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  tier: 'Free',
                  audience: 'For individual evaluation & learning',
                  price: '$0',
                  cadence: 'per month',
                  pages: '500 crawl pages / mo',
                  storage: '100 MB artifact storage',
                  ai: '50 AI reconstructions / mo',
                },
                {
                  tier: 'Pro',
                  audience: 'For full-stack engineers & freelancers',
                  price: '$29',
                  cadence: 'per month',
                  pages: '10,000 crawl pages / mo',
                  storage: '1 GB artifact storage',
                  ai: '1,000 AI reconstructions / mo',
                  featured: true,
                },
                {
                  tier: 'Business',
                  audience: 'For agencies & migration teams',
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
                  className={`p-6 rounded-xl border flex flex-col justify-between ${
                    plan.featured
                      ? 'border-indigo-500 bg-[#11192E]'
                      : 'border-slate-800 bg-[#0D1320]'
                  }`}
                >
                  <div>
                    <div className="text-lg font-bold text-white">{plan.tier}</div>
                    <div className="text-xs text-slate-400 mt-1 mb-5">{plan.audience}</div>
                    <div className="flex items-baseline gap-1.5 mb-6 tabular-nums">
                      <span className="text-3xl font-bold text-white font-mono">{plan.price}</span>
                      <span className="text-xs text-slate-400">{plan.cadence}</span>
                    </div>
                    <div className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800 pt-4 font-mono tabular-nums">
                      <div>· {plan.pages}</div>
                      <div>· {plan.storage}</div>
                      <div>· {plan.ai}</div>
                      <div>· Full ZIP & IDE Code Explorer</div>
                    </div>
                  </div>
                  <button
                    onClick={() => (isAuthenticated ? onNavigateDashboard() : onOpenAuth('signup'))}
                    className={`mt-6 w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                      plan.featured
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white'
                    }`}
                  >
                    {isAuthenticated ? 'Manage in Dashboard' : `Start with ${plan.tier}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqs.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={item.q} className="rounded-xl border border-slate-800 bg-[#0D1320]">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-white"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
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

      {/* QUIET FOOTER */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} SiteForge AI. Authorized Website Analysis & Reconstruction Platform.</div>
          <div className="flex items-center gap-6">
            <a href="/api/openapi.json" target="_blank" rel="noreferrer" className="hover:text-slate-300">
              OpenAPI Spec
            </a>
            <a href="/health" target="_blank" rel="noreferrer" className="hover:text-slate-300">
              System Health
            </a>
            <button onClick={() => onOpenAuth('login')} className="hover:text-slate-300">
              Developer Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
