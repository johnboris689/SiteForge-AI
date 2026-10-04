import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileCode, Globe, Layers, Play, ShieldCheck, Sliders, Sparkles, X, Cpu } from 'lucide-react';
import { DEFAULT_CRAWL_CONFIG, CrawlConfig } from '../shared/types.ts';
import { PLATFORM_PRESETS, mergePresetWithConfig } from '../shared/platform-presets.ts';

interface UrlAnalyzerModalProps {
  isOpen: boolean;
  initialUrl?: string;
  initialPresetId?: string;
  onClose: () => void;
  onStartProject: (payload: {
    url: string;
    name: string;
    mode: 'DOWNLOAD' | 'ANALYZE' | 'RECREATE' | 'PAGE_ONLY';
    config: CrawlConfig;
    acceptedAcceptableUse: boolean;
  }) => Promise<void>;
}

type SimpleChoice = 'page' | 'nearby' | 'whole' | 'choose';

const SIMPLE_CHOICES: Array<{
  id: SimpleChoice;
  title: string;
  description: string;
  mode: 'PAGE_ONLY' | 'ANALYZE' | 'RECREATE';
  scope: CrawlConfig['scope'];
  maxPages: number;
  maxDepth: number;
}> = [
  {
    id: 'page',
    title: 'Only this page',
    description: 'Copy and analyze only the page in the URL.',
    mode: 'PAGE_ONLY',
    scope: 'SINGLE_PAGE',
    maxPages: 1,
    maxDepth: 0,
  },
  {
    id: 'nearby',
    title: 'This page + nearby pages',
    description: 'Start here and include a small number of pages from the same website.',
    mode: 'RECREATE',
    scope: 'SAME_DOMAIN',
    maxPages: 8,
    maxDepth: 2,
  },
  {
    id: 'whole',
    title: 'Whole website',
    description: 'Scan the website as deeply as the available page limit allows.',
    mode: 'RECREATE',
    scope: 'ENTIRE',
    maxPages: 20,
    maxDepth: 5,
  },
  {
    id: 'choose',
    title: 'Choose pages later',
    description: 'Scan the site first, then use the workspace to choose the pages you want.',
    mode: 'ANALYZE',
    scope: 'SELECTED_PAGES',
    maxPages: 8,
    maxDepth: 2,
  },
];

export function UrlAnalyzerModal({
  isOpen,
  initialUrl = 'https://example.com',
  initialPresetId,
  onClose,
  onStartProject,
}: UrlAnalyzerModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(initialPresetId || null);
  const [mode, setMode] = useState<'DOWNLOAD' | 'ANALYZE' | 'RECREATE' | 'PAGE_ONLY'>('PAGE_ONLY');
  const [config, setConfig] = useState<CrawlConfig>({ ...DEFAULT_CRAWL_CONFIG, scope: 'SINGLE_PAGE', maxPages: 1, maxDepth: 0 });
  const [customUrlsText, setCustomUrlsText] = useState('');
  const [simpleChoice, setSimpleChoice] = useState<SimpleChoice>('page');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setUrl(initialUrl || 'https://example.com');
    setError(null);
    setAcceptedPolicy(false);
    setAdvancedOpen(false);
    if (initialPresetId) {
      const preset = PLATFORM_PRESETS.find((p) => p.id === initialPresetId);
      if (preset) {
        setSelectedPresetId(preset.id);
        setMode(preset.defaultMode);
        setConfig(mergePresetWithConfig(preset));
        setSimpleChoice(preset.defaultMode === 'PAGE_ONLY' ? 'page' : 'nearby');
        return;
      }
    }
    setSelectedPresetId(null);
    setMode('PAGE_ONLY');
    setSimpleChoice('page');
    setConfig({ ...DEFAULT_CRAWL_CONFIG, scope: 'SINGLE_PAGE', maxPages: 1, maxDepth: 0 });
  }, [isOpen, initialUrl, initialPresetId]);

  const activePreset = useMemo(
    () => PLATFORM_PRESETS.find((p) => p.id === selectedPresetId),
    [selectedPresetId]
  );

  if (!isOpen) return null;

  const applySimpleChoice = (choice: SimpleChoice) => {
    const selected = SIMPLE_CHOICES.find((item) => item.id === choice);
    if (!selected) return;
    setSimpleChoice(choice);
    setMode(selected.mode);
    setConfig((prev) => ({
      ...prev,
      scope: selected.scope,
      maxPages: selected.maxPages,
      maxDepth: selected.maxDepth,
    }));
  };

  const handleSelectPreset = (presetId: string) => {
    if (selectedPresetId === presetId) {
      setSelectedPresetId(null);
      return;
    }
    const preset = PLATFORM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setMode(preset.defaultMode);
    setConfig(mergePresetWithConfig(preset));
    setAdvancedOpen(true);
    if (!url || url === 'https://example.com') setUrl(preset.sampleUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acceptedPolicy) {
      setError('Please confirm that you own this website or have permission to analyze it.');
      return;
    }
    if (!url.trim()) {
      setError('Please enter a website URL.');
      return;
    }

    setSubmitting(true);
    try {
      const customUrls = customUrlsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await onStartProject({
        url: url.trim(),
        name,
        mode,
        config: { ...config, customUrls },
        acceptedAcceptableUse: acceptedPolicy,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start website analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  const simpleChoice = SIMPLE_CHOICES.find((item) => item.id === simpleChoice);

  return (
    <div
      className="fixed inset-0 z-50 min-h-[100dvh] overflow-y-auto bg-[#07070A]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analyzer-config-title"
    >
      <div className="sf-analyzer-shell min-h-[100dvh]">
        <header className="sf-analyzer-header">
          <div className="sf-analyzer-brand">
            <span>Site Forge AI <small>website analyzer & AI reconstruction</small></span>
            <button type="button" onClick={onClose} aria-label="Close analyzer" title="Close analyzer" className="sf-analyzer-close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="sf-analyzer-blackbar">Site Forge AI — Analyze, reconstruct, and export authorized websites</div>
          <nav className="sf-analyzer-nav" aria-label="Analyzer navigation">
            <a href="#analyzer-start">Start</a>
            <a href="#analyzer-choice">What do you want?</a>
            <a href="#analyzer-advanced">Advanced</a>
            <a href="#analyzer-security">Authorization</a>
            <button type="button" onClick={onClose}>Back to Site Forge</button>
          </nav>
        </header>

        <main className="sf-analyzer-main">
          <div className="sf-analyzer-wrap">
            <div className="sf-analyzer-titlebar">Site Forge AI — Simple Website Analyzer</div>
            <div className="sf-analyzer-body">
              <div className="sf-analyzer-intro" id="analyzer-start">
                <div className="sf-analyzer-kicker"><Globe className="w-3.5 h-3.5" /> START HERE</div>
                <h2 id="analyzer-config-title">What do you want to analyze?</h2>
                <p>Enter a website address, choose one simple option, confirm you have permission, and Site Forge AI will do the rest.</p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <section>
                  <label htmlFor="siteforge-url" className="block text-sm font-bold text-white mb-2">Website URL</label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                    <input
                      id="siteforge-url"
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-800 bg-[#08080C] text-sm font-mono text-white focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">You can paste the homepage, a login page, a pricing page, or any other page you are authorized to analyze.</p>
                </section>

                <section id="analyzer-choice">
                  <div className="flex items-end justify-between gap-3 mb-2">
                    <div>
                      <label className="block text-sm font-bold text-white">How much of the website?</label>
                      <p className="text-xs text-zinc-500 mt-1">Pick the simple choice that matches what you want.</p>
                    </div>
                    {simpleChoice && <span className="text-[10px] font-mono text-rose-400">{simpleChoice.title}</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SIMPLE_CHOICES.map((choice) => {
                      const active = simpleChoice === choice.id;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => applySimpleChoice(choice.id)}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            active
                              ? 'border-rose-500 bg-rose-600/10 text-white shadow-md'
                              : 'border-zinc-800/90 bg-[#121218] text-zinc-300 hover:border-zinc-700'
                          }`}
                          aria-pressed={active}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            {choice.id === 'page' && <FileCode className="w-4 h-4 text-rose-500" />}
                            {choice.id === 'nearby' && <Layers className="w-4 h-4 text-rose-500" />}
                            {choice.id === 'whole' && <Globe className="w-4 h-4 text-rose-500" />}
                            {choice.id === 'choose' && <Sliders className="w-4 h-4 text-rose-500" />}
                            <span className="font-bold text-sm">{choice.title}</span>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{choice.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="p-4 rounded-xl border border-zinc-800 bg-[#121218]">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Cpu className="w-4 h-4 text-rose-500" />
                    SiteForge will use its existing AI workflow
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Your choice only controls how much of the site is discovered. The existing Site Forge AI analysis, reconstruction, asset handling, and export features remain available.
                  </p>
                </section>

                <section id="analyzer-advanced" className="rounded-xl border border-zinc-800 bg-[#0F0F15] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((value) => !value)}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left"
                    aria-expanded={advancedOpen}
                  >
                    <span>
                      <span className="block text-sm font-bold text-white">Advanced options</span>
                      <span className="block text-xs text-zinc-500 mt-0.5">Optional settings for experienced users. Beginners can leave these alone.</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {advancedOpen && (
                    <div className="p-4 pt-0 space-y-5 border-t border-zinc-800/80">
                      <div className="pt-4">
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Project Name (Optional)</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Auto-named from domain"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-[#08080C] text-sm text-white focus:border-rose-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Platform Optimization Profile
                          </label>
                          {activePreset && <span className="text-[11px] font-mono text-rose-400">{activePreset.name} active</span>}
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
                          {PLATFORM_PRESETS.slice(0, 10).map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleSelectPreset(preset.id)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-all ${
                                selectedPresetId === preset.id
                                  ? 'border-rose-500 bg-rose-600/20 text-white'
                                  : 'border-zinc-800 bg-[#14141C] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                              }`}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Analysis type</label>
                          <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value as typeof mode)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-[#08080C] text-xs font-medium text-white"
                          >
                            <option value="RECREATE">Recreate Website with AI</option>
                            <option value="ANALYZE">Analyze Website Architecture</option>
                            <option value="PAGE_ONLY">Analyze Single Page</option>
                            <option value="DOWNLOAD">Export Project Archive</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Reconstruction depth</label>
                          <select
                            value={config.extractionMode}
                            onChange={(e) => setConfig({ ...config, extractionMode: e.target.value as CrawlConfig['extractionMode'] })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-[#08080C] text-xs font-medium text-white"
                          >
                            <option value="AI_RECONSTRUCTION">AI Full-Stack Reconstruction</option>
                            <option value="DEEP_ANALYSIS">Deep Architecture & Design Token Analysis</option>
                            <option value="FRONTEND_ANALYSIS">Frontend Component Decomposition</option>
                            <option value="STATIC_MIRROR">Public Source & Asset Extraction</option>
                          </select>
                        </div>
                      </div>

                      {config.scope === 'CUSTOM_LIST' && (
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Custom pages (one per line)</label>
                          <textarea
                            rows={3}
                            value={customUrlsText}
                            onChange={(e) => setCustomUrlsText(e.target.value)}
                            placeholder="/pricing\n/about\n/docs"
                            className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-[#08080C] text-xs font-mono text-white"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <label className="p-3 rounded-xl border border-zinc-800 bg-[#121218] text-xs">
                          <span className="flex justify-between text-zinc-400"><span>Max Pages</span><strong className="text-white">{config.maxPages}</strong></span>
                          <input type="range" min={1} max={20} value={config.maxPages} onChange={(e) => setConfig({ ...config, maxPages: Number(e.target.value) })} className="w-full accent-rose-600 mt-2" />
                        </label>
                        <label className="p-3 rounded-xl border border-zinc-800 bg-[#121218] text-xs">
                          <span className="flex justify-between text-zinc-400"><span>Crawl Depth</span><strong className="text-white">{config.maxDepth}</strong></span>
                          <input type="range" min={0} max={5} value={config.maxDepth} onChange={(e) => setConfig({ ...config, maxDepth: Number(e.target.value) })} className="w-full accent-rose-600 mt-2" />
                        </label>
                        <label className="p-3 rounded-xl border border-zinc-800 bg-[#121218] text-xs">
                          <span className="flex justify-between text-zinc-400"><span>Asset Limit</span><strong className="text-white">{config.maxFileSizeKb} KB</strong></span>
                          <input type="range" min={256} max={8192} step={256} value={config.maxFileSizeKb} onChange={(e) => setConfig({ ...config, maxFileSizeKb: Number(e.target.value) })} className="w-full accent-rose-600 mt-2" />
                        </label>
                        <label className="p-3 rounded-xl border border-zinc-800 bg-[#121218] text-xs">
                          <span className="flex justify-between text-zinc-400"><span>Delay</span><strong className="text-white">{config.requestDelayMs} ms</strong></span>
                          <input type="range" min={0} max={1500} step={50} value={config.requestDelayMs} onChange={(e) => setConfig({ ...config, requestDelayMs: Number(e.target.value) })} className="w-full accent-rose-600 mt-2" />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-zinc-800 bg-[#121218]">
                          <div className="text-xs font-bold text-white mb-2.5">Public assets</div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                            {([['html','HTML Structure'],['css','CSS Stylesheets'],['js','JavaScript Modules'],['images','Images & Media'],['svg','SVG Icons & Vectors'],['fonts','Typography & Fonts'],['json','Public JSON / Manifest'],['metadata','Sitemap & robots.txt']] as const).map(([key,label]) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={config.assets[key]} onChange={(e) => setConfig({ ...config, assets: { ...config.assets, [key]: e.target.checked } })} className="rounded border-zinc-700 bg-zinc-900 text-rose-600" />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl border border-zinc-800 bg-[#121218]">
                          <div className="text-xs font-bold text-white mb-2.5">Crawler safety & boundaries</div>
                          <div className="grid grid-cols-1 gap-2 text-xs text-zinc-300">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.respectRobotsTxt} onChange={(e) => setConfig({ ...config, respectRobotsTxt: e.target.checked })} className="rounded border-zinc-700 bg-zinc-900 text-rose-600" /><span>Respect robots.txt</span></label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.sameDomainOnly} onChange={(e) => setConfig({ ...config, sameDomainOnly: e.target.checked })} className="rounded border-zinc-700 bg-zinc-900 text-rose-600" /><span>Stay on the same domain</span></label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.followExternalAssets} onChange={(e) => setConfig({ ...config, followExternalAssets: e.target.checked })} className="rounded border-zinc-700 bg-zinc-900 text-rose-600" /><span>Inspect public CDN assets</span></label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.includeSubdomains} onChange={(e) => setConfig({ ...config, includeSubdomains: e.target.checked })} className="rounded border-zinc-700 bg-zinc-900 text-rose-600" /><span>Include authorized subdomains</span></label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section id="analyzer-security" className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-950/10">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedPolicy}
                      onChange={(e) => setAcceptedPolicy(e.target.checked)}
                      className="mt-1 rounded border-zinc-700 bg-zinc-900 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs text-zinc-300 leading-relaxed">
                      <span className="font-bold text-white flex items-center gap-1.5 mb-1"><ShieldCheck className="w-4 h-4 text-emerald-400" /> I own this website or I have permission to analyze it.</span>
                      I understand that Site Forge AI analyzes publicly accessible website resources and does not capture passwords, cookies, session tokens, or private credentials.
                    </span>
                  </label>
                </section>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                  <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">Cancel</button>
                  <button
                    type="submit"
                    disabled={submitting || !acceptedPolicy}
                    className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Starting...' : 'Analyze Website'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
