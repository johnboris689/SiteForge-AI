import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Cpu,
  Download,
  ExternalLink,
  FileCode2,
  GitBranch,
  Globe,
  Layers,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  WandSparkles,
} from 'lucide-react';
import { PLATFORM_PRESETS, RECONSTRUCTION_PLAYBOOKS } from '../shared/platform-presets.ts';

interface LandingPageProps {
  isAuthenticated: boolean;
  onOpenAnalyzer: (initialUrl: string, presetId?: string) => void;
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
  {
    q: 'What does Site Forge AI actually do?',
    a: 'Site Forge AI analyzes authorized public websites, maps their structure and assets, and gives you a workspace for rebuilding the experience as a new, maintainable application rather than simply presenting a screenshot.',
  },
  {
    q: 'Can I export the generated source code?',
    a: 'Yes. Projects can be packaged as source archives and prepared for GitHub publishing. The workspace is designed around owning and editing the resulting code.',
  },
  {
    q: 'Can Site Forge AI copy private websites or credentials?',
    a: 'No. The analyzer is intended for public content or websites you own or are authorized to analyze. It must not capture passwords, session cookies, MFA codes, authentication tokens, or other private credentials.',
  },
  {
    q: 'Can I rebuild a website into a different technology stack?',
    a: 'Yes. The AI reconstruction workflow can be used to transform the analyzed structure into a fresh implementation with your chosen application architecture while preserving the useful product behavior and information hierarchy.',
  },
];

export function LandingPage({
  isAuthenticated,
  onOpenAnalyzer,
  onOpenAuth,
  onNavigateDashboard,
}: LandingPageProps) {
  const [heroUrl, setHeroUrl] = useState('https://example.com');
  const [depth, setDepth] = useState('2');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onOpenAnalyzer(heroUrl);
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

        <div className="sf-announcement">
          <Sparkles className="w-4 h-4" />
          <span>Analyze websites. Rebuild the experience. Own the source code.</span>
        </div>

        <nav className="sf-nav" aria-label="Primary navigation">
          <a href="#analyzer">Analyzer</a>
          <a href="#workflow">How it works</a>
          <a href="#platforms">Platforms</a>
          <a href="#workspace">Workspace</a>
          <a href="#faq">FAQ</a>
          {isAuthenticated ? (
            <button type="button" onClick={onNavigateDashboard}>Project Dashboard</button>
          ) : (
            <button type="button" onClick={() => onOpenAuth('login')}>Sign in with GitHub</button>
          )}
        </nav>
      </header>

      <main id="top" className="sf-main">
        <section className="sf-hero sf-wrap" id="analyzer">
          <div className="sf-kicker">SITE FORGE AI — WEBSITE ANALYZER</div>
          <h1>Turn an authorized website into a <span>forgeable codebase.</span></h1>
          <p className="sf-lead">
            Analyze public structure, pages, assets and design signals, then move the result into an AI reconstruction workspace built for developers.
          </p>

          <form className="sf-tool" onSubmit={submit}>
            <div className="sf-tool-title">
              <span>Site Forge AI / Website Analyzer</span>
              <span className="sf-tool-status">READY</span>
            </div>
            <div className="sf-tool-body">
              <div className="sf-form-row">
                <label htmlFor="sf-url">Web address (URL):</label>
                <input id="sf-url" type="url" value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)} placeholder="https://example.com" required />
              </div>
              <div className="sf-form-row">
                <label htmlFor="sf-depth">Analysis depth:</label>
                <select id="sf-depth" value={depth} onChange={(e) => setDepth(e.target.value)}>
                  <option value="1">1 — this page only</option>
                  <option value="2">2 — linked pages</option>
                  <option value="3">3 — broader site crawl</option>
                </select>
                <button className="sf-button" type="submit"><Search className="w-4 h-4" /> Analyze website</button>
              </div>
              <div className="sf-hint">
                <ShieldCheck className="w-3.5 h-3.5" /> Analyze only websites you own or have permission to inspect. Credentials and private session data are not collected.
              </div>

              <div className="sf-progress-preview" aria-hidden="true">
                <div className="sf-progress-head"><span>Analysis pipeline</span><span>Waiting for URL</span></div>
                <div className="sf-progress-track"><span /></div>
                <div className="sf-terminal">
                  <div><span>›</span> URL validation ............ <b>READY</b></div>
                  <div><span>›</span> Route discovery .......... <b>READY</b></div>
                  <div><span>›</span> Asset inspection .......... <b>READY</b></div>
                  <div><span>›</span> AI reconstruction ......... <b>QUEUED</b></div>
                </div>
              </div>
            </div>
          </form>

          <div className="sf-badges">
            <span>Public URL analysis</span><span>Live crawl pipeline</span><span>AI reconstruction</span><span>ZIP source export</span><span>GitHub publishing</span>
          </div>
        </section>

        <section className="sf-section sf-alt" id="workflow">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <div>
                <div className="sf-kicker">HOW THE FORGE WORKS</div>
                <h2>From URL to editable project</h2>
                <p>Keep the practical, tool-first structure of a website copier while adding the engineering workflow Site Forge AI is built for.</p>
              </div>
            </div>
            <div className="sf-step-grid">
              {workflows.map(([step, title, desc, Icon]) => (
                <article className="sf-card sf-step" key={step}>
                  <div className="sf-step-number">{step}</div>
                  <div className="sf-icon"><Icon className="w-5 h-5" /></div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sf-section" id="platforms">
          <div className="sf-wrap">
            <div className="sf-section-head split">
              <div>
                <div className="sf-kicker">PLATFORM PROFILES</div>
                <h2>Start with a known web platform</h2>
                <p>Use a profile to pre-configure the analyzer for common website architectures, or enter any custom URL above.</p>
              </div>
              <button className="sf-button sf-button-dark" onClick={() => onOpenAnalyzer(heroUrl)} type="button">Open custom analyzer <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="sf-grid-4">
              {PLATFORM_PRESETS.map((preset) => (
                <article className="sf-card sf-platform" key={preset.id}>
                  <div className="sf-card-top"><span className="sf-icon"><Layers className="w-4 h-4" /></span><span className="sf-tag">{preset.category}</span></div>
                  <h3>{preset.name}</h3>
                  <p>{preset.signatureNotes}</p>
                  <button type="button" onClick={() => onOpenAnalyzer(preset.sampleUrl, preset.id)} className="sf-link-button">Analyze {preset.name} <ArrowRight className="w-3.5 h-3.5" /></button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sf-section sf-alt" id="workspace">
          <div className="sf-wrap sf-workspace-grid">
            <div>
              <div className="sf-kicker">PROJECT WORKSPACE</div>
              <h2>Not just a downloaded folder.</h2>
              <p className="sf-lead-small">The reference site's practical copier workflow becomes the front door to a real development workspace: inspect routes, browse assets, edit generated files, reconstruct with AI, export the source, and publish to GitHub.</p>
              <div className="sf-feature-list">
                {[
                  [Globe, 'Route and page map', 'Understand what was discovered and how the public pages connect.'],
                  [FileCode2, 'Code and asset explorer', 'Review generated files, styles, scripts, images, SVGs and fonts.'],
                  [Cpu, 'AI reconstruction engine', 'Turn analysis into a fresh, maintainable application architecture.'],
                  [GitBranch, 'GitHub publishing', 'Move the resulting project into your own repository without fake deployment steps.'],
                ].map(([Icon, title, desc]) => (
                  <div className="sf-feature" key={title as string}><span className="sf-icon"><Icon className="w-4 h-4" /></span><div><b>{title as string}</b><p>{desc as string}</p></div></div>
                ))}
              </div>
            </div>

            <div className="sf-console">
              <div className="sf-console-title"><span><Terminal className="w-4 h-4" /> forge-workspace</span><span>LIVE</span></div>
              <div className="sf-console-body">
                <div className="sf-console-line"><span className="muted">01</span> <span className="red">analyze</span> <span>https://authorized-site.example</span></div>
                <div className="sf-console-line"><span className="muted">02</span> <Check /> <span>routes discovered</span><b>24</b></div>
                <div className="sf-console-line"><span className="muted">03</span> <Check /> <span>assets indexed</span><b>187</b></div>
                <div className="sf-console-line"><span className="muted">04</span> <Check /> <span>design tokens mapped</span><b>42</b></div>
                <div className="sf-console-line"><span className="muted">05</span> <span className="red">rebuild</span> <span>React + TypeScript</span></div>
                <div className="sf-console-line"><span className="muted">06</span> <span className="red">export</span> <span>site-forge-project.zip</span></div>
                <div className="sf-console-line"><span className="muted">07</span> <span className="red">push</span> <span>GitHub repository</span></div>
              </div>
              <div className="sf-console-actions">
                <button type="button" onClick={() => onOpenAnalyzer(heroUrl)} className="sf-button"><WandSparkles className="w-4 h-4" /> Launch analyzer</button>
                <button type="button" onClick={() => (isAuthenticated ? onNavigateDashboard() : onOpenAuth('login'))} className="sf-button sf-button-outline"><GitBranch className="w-4 h-4" /> {isAuthenticated ? 'Open workspace' : 'Continue with GitHub'}</button>
              </div>
            </div>
          </div>
        </section>

        <section className="sf-section" id="playbooks">
          <div className="sf-wrap">
            <div className="sf-section-head"><div><div className="sf-kicker">RECONSTRUCTION PLAYBOOKS</div><h2>Guided workflows for real projects</h2><p>Use the existing Site Forge AI playbooks without losing the compact, practical feel of the reference interface.</p></div></div>
            <div className="sf-grid-2">
              {RECONSTRUCTION_PLAYBOOKS.map((playbook) => (
                <article className="sf-card sf-playbook" key={playbook.id}>
                  <div className="sf-card-top"><span className="sf-tag">{playbook.category}</span><span className="sf-muted-code">{playbook.recommendedMode}</span></div>
                  <h3>{playbook.title}</h3><p>{playbook.summary}</p>
                  <ol>{playbook.steps.map((step, index) => <li key={index}><b>{index + 1}</b>{step}</li>)}</ol>
                  <button type="button" className="sf-link-button" onClick={() => onOpenAnalyzer(heroUrl)}>Run in analyzer <ArrowRight className="w-3.5 h-3.5" /></button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sf-section sf-alt" id="faq">
          <div className="sf-wrap sf-narrow">
            <div className="sf-kicker">FAQ & SAFETY</div><h2>Questions before you forge</h2>
            <div className="sf-faq">
              {faqs.map((item, index) => {
                const open = openFaq === index;
                return <div className={`sf-faq-item ${open ? 'open' : ''}`} key={item.q}>
                  <button type="button" onClick={() => setOpenFaq(open ? null : index)}><span>{item.q}</span><ChevronDown className="w-4 h-4" /></button>
                  {open && <p>{item.a}</p>}
                </div>;
              })}
            </div>
          </div>
        </section>

        <section className="sf-cta">
          <div className="sf-wrap sf-cta-inner">
            <div><div className="sf-kicker">READY TO BUILD</div><h2>Bring a website into the forge.</h2><p>Start with a URL you own or are authorized to analyze.</p></div>
            <button type="button" className="sf-button" onClick={() => onOpenAnalyzer(heroUrl)}><Download className="w-4 h-4" /> Start website analysis</button>
          </div>
        </section>
      </main>

      <footer className="sf-footer">
        <div className="sf-footer-grid sf-wrap">
          <div><div className="sf-footer-brand"><ForgeMark className="w-7 h-7" /><b>Site Forge AI</b></div><p>Website analysis and AI reconstruction studio for developers who want editable source code.</p></div>
          <div><h4>Product</h4><a href="#analyzer">Analyzer</a><a href="#workspace">Workspace</a><a href="#platforms">Platforms</a></div>
          <div><h4>Engineering</h4><a href="#workflow">Workflow</a><a href="#playbooks">Playbooks</a><a href="/health" target="_blank" rel="noreferrer">System health</a></div>
          <div><h4>Account</h4>{isAuthenticated ? <button onClick={onNavigateDashboard}>Project dashboard</button> : <button onClick={() => onOpenAuth('login')}>Continue with GitHub</button>}<a href="/api/openapi.json" target="_blank" rel="noreferrer">OpenAPI <ExternalLink className="inline w-3 h-3" /></a></div>
        </div>
        <div className="sf-wrap sf-legal"><span>© {new Date().getFullYear()} Site Forge AI</span><span><LockKeyhole className="inline w-3 h-3" /> Use only on websites you own or have permission to analyze.</span></div>
      </footer>
    </div>
  );
}
