import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  Download,
  FileCode2,
  GitBranch,
  Globe,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  WandSparkles,
  LoaderCircle,
} from 'lucide-react';
import { PLATFORM_PRESETS } from '../shared/platform-presets.ts';
import type { CrawlConfig } from '../shared/types.ts';

interface AnalysisState {
  projectId: number | null;
  job: any | null;
  events: any[];
  error: string | null;
}

interface LandingPageProps {
  isAuthenticated: boolean;
  analysisState: AnalysisState;
  onStartAnalysis: (payload: {
    url: string;
    name: string;
    mode: 'DOWNLOAD' | 'ANALYZE' | 'RECREATE' | 'PAGE_ONLY';
    config: CrawlConfig;
    acceptedAcceptableUse: boolean;
  }) => Promise<void>;
  onDownloadZip: () => Promise<void>;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onNavigateDashboard: () => void;
}

export function ForgeMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="6" fill="#0b0b0d" stroke="#dc2626" strokeWidth="1.5" />
      <path d="M8 10h20l-4 6H12l-4-6Z" fill="#dc2626" />
      <path d="M12 20h12l4 6H8l4-6Z" fill="#ef4444" />
      <circle cx="18" cy="18" r="2" fill="#fff" />
    </svg>
  );
}

const workflows = [
  ['01', 'Analyze URL', 'Enter an authorized public URL and inspect its routes, markup, assets, styles, and technology signals.', Globe],
  ['02', 'Inspect & Map', 'Build a structured view of pages, assets, design tokens, responsive behavior, and dependencies.', Search],
  ['03', 'AI Rebuild', 'Turn the analysis into clean React, TypeScript, Tailwind and backend-ready project code.', WandSparkles],
  ['04', 'Workspace', 'Review files, pages, assets and generated code before exporting or publishing the project.', Code2],
  ['05', 'Ship to GitHub', 'Create or connect a repository and push the generated source through the GitHub integration.', GitBranch],
] as const;

const faqs = [
  ['What does Site Forge AI actually do?', 'Site Forge AI analyzes authorized public websites, maps their structure and assets, and gives you a workspace for rebuilding the experience as a new maintainable application.'],
  ['Does clicking Analyze open another analyzer page?', 'No. The analyzer starts directly from this page. The progress panel below the form becomes the live crawl and packaging monitor.'],
  ['When can I download the ZIP?', 'Only after the server reports that analysis and source packaging are complete. The download button is hidden until the job reaches the completed state.'],
  ['Can I analyze any URL?', 'You can enter a public HTTP or HTTPS URL. You must tick the authorization checkbox confirming that you own the website or have permission to analyze it.'],
];

const idleSteps = ['Waiting for URL', 'No crawl started', 'No files processed'];

function progressPercent(job: any | null) {
  if (!job) return 0;
  if (typeof job.progressPercent === 'number') return Math.max(0, Math.min(100, job.progressPercent));
  if (job.status === 'completed') return 100;
  if (job.status === 'validating') return 8;
  if (job.status === 'crawling') {
    const total = Math.max(Number(job.pagesTotal || 1), 1);
    return 10 + Math.min(38, Math.round((Number(job.pagesProcessed || 0) / total) * 38));
  }
  if (job.status === 'analyzing') return 72;
  if (job.status === 'packaging') return 88;
  if (job.status === 'failed' || job.status === 'cancelled') return 100;
  return 4;
}

function eventDone(event: any, latestId?: number) {
  if (event.level === 'success') return true;
  return Boolean(latestId && event.id !== latestId);
}

export function LandingPage({
  isAuthenticated,
  analysisState,
  onStartAnalysis,
  onDownloadZip,
  onOpenAuth,
  onNavigateDashboard,
}: LandingPageProps) {
  const [heroUrl, setHeroUrl] = useState('https://example.com');
  const [depth, setDepth] = useState<'page' | 'linked' | 'whole'>('linked');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const job = analysisState.job;
  const running = Boolean(job && ['queued', 'validating', 'crawling', 'analyzing', 'reconstructing', 'packaging'].includes(job.status));
  const completed = job?.status === 'completed';
  const failed = job?.status === 'failed' || job?.status === 'cancelled';
  const percent = progressPercent(job);
  const latestEventId = analysisState.events.length ? analysisState.events[analysisState.events.length - 1]?.id : undefined;

  const displayEvents = useMemo(() => {
    const events = analysisState.events.slice(-14);
    if (events.length) return events;
    return idleSteps.map((message, index) => ({ id: `idle-${index}`, step: 'waiting', message, level: 'idle' }));
  }, [analysisState.events]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!acceptedPolicy || running) return;
    setSubmitting(true);
    try {
      const config: CrawlConfig = {
        scope: depth === 'page' ? 'SINGLE_PAGE' : depth === 'whole' ? 'ENTIRE' : 'SAME_DOMAIN',
        extractionMode: 'DEEP_ANALYSIS',
        maxPages: depth === 'page' ? 1 : depth === 'whole' ? 20 : 8,
        maxDepth: depth === 'page' ? 0 : depth === 'whole' ? 5 : 2,
        maxFileSizeKb: 2048,
        requestDelayMs: 150,
        sameDomainOnly: true,
        includeSubdomains: false,
        followExternalAssets: true,
        respectRobotsTxt: true,
        stopOnError: false,
        retryFailed: true,
        assets: { html: true, css: true, js: true, images: true, svg: true, fonts: true, json: true, metadata: true },
      };
      await onStartAnalysis({
        url: heroUrl.trim(),
        name: '',
        mode: depth === 'page' ? 'PAGE_ONLY' : 'DOWNLOAD',
        config,
        acceptedAcceptableUse: acceptedPolicy,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sf-shell min-h-screen bg-[#070707] text-zinc-100">
      <header className="sf-header">
        <div className="sf-brand-row">
          <a href="#top" className="sf-brand" aria-label="Site Forge AI home">
            <ForgeMark className="w-9 h-9" />
            <span className="sf-wordmark">Site Forge <small>AI</small></span>
          </a>
          <span className="sf-beta">developer studio</span>
        </div>
        <div className="sf-announcement"><Sparkles className="w-4 h-4" /><span>Analyze websites. Rebuild the experience. Own the source code.</span></div>
        <nav className="sf-nav" aria-label="Primary navigation">
          <a href="#analyzer">Analyzer</a>
          <a href="#workflow">How it works</a>
          <a href="#platforms">Platforms</a>
          <a href="#workspace">Workspace</a>
          <a href="#faq">FAQ</a>
          {isAuthenticated ? <button type="button" onClick={onNavigateDashboard}>Project Dashboard</button> : <button type="button" onClick={() => onOpenAuth('login')}>Sign in with GitHub</button>}
        </nav>
      </header>

      <main id="top" className="sf-main">
        <section className="sf-hero sf-wrap" id="analyzer">
          <div className="sf-kicker">SITE FORGE AI — WEBSITE ANALYZER</div>
          <h1>Analyze a URL and <span>forge the source.</span></h1>
          <p className="sf-lead">Enter the website once. Site Forge AI crawls the selected scope, inspects public assets, analyzes the structure, packages the source, and reports the real server-side progress here.</p>

          <form className="sf-tool" onSubmit={submit}>
            <div className="sf-tool-title"><span>Site Forge AI / Website Analyzer</span><span className="sf-tool-status">{completed ? 'COMPLETE' : running ? 'RUNNING' : failed ? 'FAILED' : 'READY'}</span></div>
            <div className="sf-tool-body">
              <div className="sf-form-row sf-url-row">
                <label htmlFor="sf-url">Web address (URL):</label>
                <input id="sf-url" type="text" inputMode="url" value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)} placeholder="https://example.com" required disabled={running} />
              </div>
              <div className="sf-form-row">
                <label htmlFor="sf-depth">Analysis depth:</label>
                <select id="sf-depth" value={depth} onChange={(e) => setDepth(e.target.value as typeof depth)} disabled={running}>
                  <option value="page">1 — this page only</option>
                  <option value="linked">2 — linked pages</option>
                  <option value="whole">3 — whole website</option>
                </select>
              </div>

              <label className="sf-authorization">
                <input type="checkbox" checked={acceptedPolicy} onChange={(e) => setAcceptedPolicy(e.target.checked)} disabled={running} />
                <span><strong>I own this website or I have permission to analyze it.</strong><small>Ticking this confirms your authorization. Site Forge AI only processes publicly accessible resources and does not collect passwords, cookies, session tokens, MFA codes, or private credentials.</small></span>
              </label>

              <button className="sf-button sf-analyze-button" type="submit" disabled={submitting || running || !acceptedPolicy || !heroUrl.trim()}>
                {running ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {submitting ? 'Starting analysis...' : running ? 'Analyzing website...' : completed ? 'Analyze another website' : 'Analyze website'}
              </button>

              {analysisState.error && <div className="sf-error" role="alert">{analysisState.error}</div>}

              <div className={`sf-live-pipeline ${analysisState.projectId ? 'active' : 'idle'}`}>
                <div className="sf-progress-head"><span>Live analysis pipeline</span><span>{analysisState.projectId ? `${percent}% — ${job?.currentStep || 'Starting...'}` : 'Waiting for Analyze website'}</span></div>
                <div className="sf-progress-track"><span style={{ width: `${percent}%` }} /></div>
                <div className="sf-terminal sf-live-terminal">
                  {displayEvents.map((event: any, index: number) => {
                    const done = eventDone(event, latestEventId);
                    const isCurrent = !done && index === displayEvents.length - 1 && !completed;
                    return (
                      <div className={`sf-progress-event ${done ? 'done' : isCurrent ? 'current' : ''}`} key={`${event.id}-${index}`}>
                        {done ? <CheckCircle2 /> : isCurrent ? <LoaderCircle className="animate-spin" /> : <span className="sf-chevron">›</span>}
                        <span className="sf-event-step">{event.step || 'worker'}</span>
                        <span className="sf-event-message">{event.message}</span>
                        <b>{done ? 'DONE' : isCurrent ? 'WORKING' : event.level === 'warn' ? 'WAITING' : ''}</b>
                      </div>
                    );
                  })}
                </div>
                {completed && (
                  <div className="sf-ready-row">
                    <CheckCircle2 className="w-5 h-5" />
                    <div><strong>ZIP source package is ready.</strong><span>The server has completed the crawl, analysis, source generation and packaging.</span></div>
                    <button type="button" className="sf-button" onClick={onDownloadZip}><Download className="w-4 h-4" /> Download ZIP</button>
                  </div>
                )}
                {failed && <div className="sf-failure-row"><span>{job?.errorMessage || 'The analysis failed. Check the latest server event above and try again.'}</span></div>}
              </div>
            </div>
          </form>

          <div className="sf-badges"><span>Public URL analysis</span><span>Live server progress</span><span>Per-file packaging</span><span>ZIP source export</span><span>GitHub publishing</span></div>
        </section>

        <section className="sf-section sf-alt" id="workflow"><div className="sf-wrap"><div className="sf-section-head"><div><div className="sf-kicker">HOW THE FORGE WORKS</div><h2>From URL to editable project</h2><p>The analyzer is now one continuous workflow: enter the URL, confirm authorization, watch the real crawler work, then download the finished source package.</p></div></div><div className="sf-step-grid">{workflows.map(([step, title, desc, Icon]) => <article className="sf-card sf-step" key={step}><div className="sf-step-number">{step}</div><div className="sf-icon"><Icon className="w-5 h-5" /></div><h3>{title}</h3><p>{desc}</p></article>)}</div></div></section>

        <section className="sf-section" id="platforms"><div className="sf-wrap"><div className="sf-section-head"><div><div className="sf-kicker">PLATFORM PROFILES</div><h2>Known web platforms, same analyzer</h2><p>Profiles remain shortcuts only. The main analyzer above accepts custom URLs without sending you through a second configuration screen.</p></div></div><div className="sf-grid-4">{PLATFORM_PRESETS.map((preset) => <article className="sf-card sf-platform" key={preset.id}><div className="sf-card-top"><span className="sf-icon"><Layers className="w-4 h-4" /></span><span className="sf-tag">{preset.category}</span></div><h3>{preset.name}</h3><p>{preset.signatureNotes}</p><button type="button" onClick={() => setHeroUrl(preset.sampleUrl)} className="sf-link-button">Use {preset.name} URL <ArrowRight className="w-3.5 h-3.5" /></button></article>)}</div></div></section>

        <section className="sf-section sf-alt" id="workspace"><div className="sf-wrap sf-workspace-grid"><div><div className="sf-kicker">PROJECT WORKSPACE</div><h2>Not just a downloaded folder.</h2><p className="sf-lead-small">Once analysis finishes, the existing Site Forge AI workspace remains available for inspecting pages, browsing extracted files, running AI reconstruction, exporting source, and publishing to GitHub.</p><div className="sf-feature-list"><div className="sf-feature"><FileCode2 className="w-5 h-5 text-red-400" /><div><b>Source tree</b><p>Generated files and extracted assets stay organized by project.</p></div></div><div className="sf-feature"><Terminal className="w-5 h-5 text-red-400" /><div><b>Real crawl events</b><p>The analyzer stream is driven by the server worker rather than a decorative timer.</p></div></div><div className="sf-feature"><GitBranch className="w-5 h-5 text-red-400" /><div><b>GitHub publishing</b><p>Keep the existing repository creation and push workflow after analysis.</p></div></div></div></div><div className="sf-console"><div className="sf-console-title"><span><span className="sf-dot" /> SITE FORGE WORKER</span><span>{completed ? 'READY' : running ? 'RUNNING' : 'IDLE'}</span></div><div className="sf-console-body"><div className="sf-console-line"><CheckCircle2 /><span>URL accepted</span><b>{analysisState.projectId ? 'YES' : 'WAITING'}</b></div><div className="sf-console-line"><CheckCircle2 /><span>Route discovery</span><b>{job?.pagesProcessed ?? 0}/{job?.pagesTotal ?? 0}</b></div><div className="sf-console-line"><CheckCircle2 /><span>Asset inspection</span><b>{job?.assetsProcessed ?? 0}/{job?.assetsTotal ?? 0}</b></div><div className="sf-console-line"><CheckCircle2 /><span>Source packaging</span><b>{completed ? 'DONE' : job?.status === 'packaging' ? 'RUNNING' : 'WAITING'}</b></div></div><div className="sf-console-actions"><button className="sf-button sf-button-dark" type="button" onClick={onNavigateDashboard}><Code2 className="w-4 h-4" /> Open workspace</button>{!isAuthenticated && <button className="sf-button sf-button-outline" type="button" onClick={() => onOpenAuth('login')}>Connect GitHub</button>}</div></div></div></section>

        <section className="sf-section" id="faq"><div className="sf-wrap sf-narrow"><div className="sf-section-head"><div><div className="sf-kicker">FAQ</div><h2>Questions before you forge</h2></div></div><div className="sf-faq">{faqs.map(([q, a], index) => <div className={`sf-faq-item ${openFaq === index ? 'open' : ''}`} key={q}><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{q}</span><ChevronDown className="w-4 h-4" /></button>{openFaq === index && <p>{a}</p>}</div>)}</div></div></section>

        <section className="sf-cta"><div className="sf-wrap sf-cta-inner"><div><div className="sf-kicker">READY TO FORGE</div><h2>One URL. One workflow. Real source.</h2><p>Start from the analyzer above and watch the actual worker progress instead of a simulated loading screen.</p></div><a href="#analyzer" className="sf-button">Start analyzing <ArrowRight className="w-4 h-4" /></a></div></section>
      </main>

      <footer className="sf-footer"><div className="sf-footer-grid"><div><div className="sf-footer-brand"><ForgeMark className="w-7 h-7" /><strong>Site Forge AI</strong></div><p>AI website analysis and reconstruction workspace for developers.</p></div><div><h4>Product</h4><a href="#analyzer">Analyzer</a><a href="#workflow">Workflow</a><a href="#workspace">Workspace</a></div><div><h4>Engineering</h4><a href="#platforms">Platforms</a><a href="#faq">FAQ</a><button type="button" onClick={onNavigateDashboard}>Dashboard</button></div><div><h4>Authorization</h4><p className="sf-footer-note"><ShieldCheck className="w-3.5 h-3.5" /> Analyze only websites you own or are authorized to inspect.</p></div></div><div className="sf-legal"><span>© {new Date().getFullYear()} Site Forge AI</span><span>Built for authorized analysis and new implementations.</span></div></footer>
    </div>
  );
}
