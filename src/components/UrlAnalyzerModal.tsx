import React, { useState } from 'react';
import { Globe, ShieldCheck, Sliders, X, Play, Layers, Cpu, Download, FileCode, Sparkles } from 'lucide-react';
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
  const [mode, setMode] = useState<'DOWNLOAD' | 'ANALYZE' | 'RECREATE' | 'PAGE_ONLY'>('RECREATE');
  const [config, setConfig] = useState<CrawlConfig>({ ...DEFAULT_CRAWL_CONFIG });
  const [customUrlsText, setCustomUrlsText] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
    if (initialPresetId) {
      const preset = PLATFORM_PRESETS.find((p) => p.id === initialPresetId);
      if (preset) {
        setSelectedPresetId(preset.id);
        setMode(preset.defaultMode);
        setConfig(mergePresetWithConfig(preset));
      }
    }
  }, [initialUrl, initialPresetId]);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    if (selectedPresetId === presetId) {
      setSelectedPresetId(null);
      setConfig({ ...DEFAULT_CRAWL_CONFIG });
      return;
    }
    const preset = PLATFORM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setMode(preset.defaultMode);
    setConfig(mergePresetWithConfig(preset));
    if (!url || url === 'https://example.com') {
      setUrl(preset.sampleUrl);
    }
  };

  const activePreset = PLATFORM_PRESETS.find((p) => p.id === selectedPresetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acceptedPolicy) {
      setError('You must confirm compliance with the Acceptable Use Policy before starting an analysis.');
      return;
    }
    setSubmitting(true);
    try {
      const customUrls = customUrlsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await onStartProject({
        url,
        name,
        mode,
        config: {
          ...config,
          customUrls,
        },
        acceptedAcceptableUse: acceptedPolicy,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start website analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  const modes = [
    {
      id: 'RECREATE' as const,
      title: 'Recreate Website with AI',
      badge: 'AI Rebuild',
      desc: 'Analyze structure, design tokens, and routes to synthesize a clean React + Tailwind + PostgreSQL project.',
      icon: Cpu,
    },
    {
      id: 'ANALYZE' as const,
      title: 'Analyze Website Architecture',
      badge: 'Deep Inspect',
      desc: 'Inspect multi-page routes, detected frameworks, CSS tokens, typography, and public assets.',
      icon: Layers,
    },
    {
      id: 'PAGE_ONLY' as const,
      title: 'Analyze Single Page',
      badge: 'Single Route',
      desc: 'Target one specific route (Landing, Pricing, Documentation, or Auth UI layout) for rapid reconstruction.',
      icon: FileCode,
    },
    {
      id: 'DOWNLOAD' as const,
      title: 'Export Project Archive',
      badge: 'ZIP Package',
      desc: 'Retrieve public HTML, CSS, JavaScript, SVGs, and fonts into an organized, downloadable project structure.',
      icon: Download,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 min-h-[100dvh] overflow-y-auto bg-[#07070A]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analyzer-config-title"
    >
      <div className="sf-analyzer-shell">
        <header className="sf-analyzer-header">
          <div className="sf-analyzer-brand">
            <span>Site Forge AI <small>website analyzer & AI reconstruction</small></span>
            <button type="button" onClick={onClose} aria-label="Close analyzer" title="Close analyzer" className="sf-analyzer-close"><X className="w-4 h-4" /></button>
          </div>
          <div className="sf-analyzer-blackbar">Site Forge AI — Analyze, reconstruct, and export authorized websites</div>
          <nav className="sf-analyzer-nav" aria-label="Analyzer navigation">
            <a href="#analyzer-options">Analysis options</a>
            <a href="#analyzer-workflow">Workflows</a>
            <a href="#analyzer-assets">Assets</a>
            <a href="#analyzer-security">Security</a>
            <button type="button" onClick={onClose}>Back to Site Forge</button>
          </nav>
        </header>

        <main className="sf-analyzer-main">
          <div className="sf-analyzer-wrap">
            <div className="sf-analyzer-titlebar">Site Forge AI — Analyzer wizard</div>
            <div className="sf-analyzer-body">
        <div className="sf-analyzer-intro" id="analyzer-options">
          <div className="sf-analyzer-kicker"><Sliders className="w-3.5 h-3.5 text-rose-500" /> SITE FORGE AI ANALYZER</div>
          <h2 id="analyzer-config-title">Website Analyzer & Reconstruction Studio</h2>
          <p>Configure the URL target, platform profile, crawl depth, asset filters, and AI reconstruction pipeline without changing any of Site Forge AI's existing capabilities.</p>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-5">
          {/* Platform Profile Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                <span>Platform Optimization Profile (Optional)</span>
              </label>
              {activePreset && (
                <span className="text-[11px] font-mono text-rose-400">
                  {activePreset.name} Profile Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
              {PLATFORM_PRESETS.slice(0, 10).map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'border-rose-500 bg-rose-600/20 text-white shadow-sm'
                        : 'border-zinc-800 bg-[#14141C] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
            {activePreset && (
              <div className="mt-2 p-2.5 rounded-lg border border-rose-500/25 bg-rose-950/15 text-[11px] text-zinc-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>{activePreset.signatureNotes}</span>
                <span className="font-mono text-rose-300 shrink-0">{activePreset.category}</span>
              </div>
            )}
          </div>

          {/* URL & Project Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Website URL to Analyze</label>
              <div className="relative">
                <Globe className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-[#08080C] text-sm font-mono text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Project Name (Optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-named from domain"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-[#08080C] text-sm text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 4 Selectable Analysis & Reconstruction Modes */}
          <div id="analyzer-workflow">
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Choose Operation Workflow</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {modes.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMode(m.id);
                      if (m.id === 'PAGE_ONLY') {
                        setConfig((prev) => ({ ...prev, scope: 'SINGLE_PAGE', maxPages: 1 }));
                      } else if (config.scope === 'SINGLE_PAGE') {
                        setConfig((prev) => ({ ...prev, scope: 'SAME_DOMAIN', maxPages: 8 }));
                      }
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      active
                        ? 'border-rose-500 bg-rose-600/10 text-white shadow-md'
                        : 'border-zinc-800/90 bg-[#121218] text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-xs text-white">
                        <Icon className="w-4 h-4 text-rose-500" />
                        <span>{m.title}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope & Extraction Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Discovery Scope</label>
              <select
                value={config.scope}
                onChange={(e) => setConfig({ ...config, scope: e.target.value as CrawlConfig['scope'] })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-[#08080C] text-xs font-medium text-white focus:border-rose-500 focus:outline-none"
              >
                <option value="SAME_DOMAIN">Analyze Website (Same-Domain Routes)</option>
                <option value="ENTIRE">Analyze Deep Multi-Page Hierarchy</option>
                <option value="SINGLE_PAGE">Analyze Single Page Only</option>
                <option value="SELECTED_PAGES">Analyze Selected Pages (Interactive Picker)</option>
                <option value="CUSTOM_LIST">Analyze Multiple Custom URLs</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Reconstruction Engine Depth</label>
              <select
                value={config.extractionMode}
                onChange={(e) =>
                  setConfig({ ...config, extractionMode: e.target.value as CrawlConfig['extractionMode'] })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-[#08080C] text-xs font-medium text-white focus:border-rose-500 focus:outline-none"
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
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Custom Relative Paths or Same-Domain URLs (one per line)
              </label>
              <textarea
                rows={3}
                value={customUrlsText}
                onChange={(e) => setCustomUrlsText(e.target.value)}
                placeholder="/pricing&#10;/about&#10;/docs"
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-[#08080C] text-xs font-mono text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          )}

          {/* Sliders & Numeric Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-zinc-800/80">
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-[#121218]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Max Pages</span>
                <span className="font-mono font-bold text-white">{config.maxPages}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={config.maxPages}
                onChange={(e) => setConfig({ ...config, maxPages: Number(e.target.value) })}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-[#121218]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Crawl Depth</span>
                <span className="font-mono font-bold text-white">{config.maxDepth}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                value={config.maxDepth}
                onChange={(e) => setConfig({ ...config, maxDepth: Number(e.target.value) })}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-[#121218]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Asset Limit</span>
                <span className="font-mono font-bold text-white">{config.maxFileSizeKb} KB</span>
              </div>
              <input
                type="range"
                min={256}
                max={8192}
                step={256}
                value={config.maxFileSizeKb}
                onChange={(e) => setConfig({ ...config, maxFileSizeKb: Number(e.target.value) })}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-[#121218]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-400">Request Delay</span>
                <span className="font-mono font-bold text-white">{config.requestDelayMs} ms</span>
              </div>
              <input
                type="range"
                min={0}
                max={1500}
                step={50}
                value={config.requestDelayMs}
                onChange={(e) => setConfig({ ...config, requestDelayMs: Number(e.target.value) })}
                className="w-full accent-rose-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Asset Options & Crawl Flags */}
          <div id="analyzer-assets" className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-800/80">
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-[#121218]">
              <div className="text-xs font-bold text-white mb-2.5">Public Asset Discovery Filters</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                {(
                  [
                    ['html', 'HTML Structure'],
                    ['css', 'CSS Stylesheets'],
                    ['js', 'JavaScript Modules'],
                    ['images', 'Images & Media'],
                    ['svg', 'SVG Icons & Vectors'],
                    ['fonts', 'Typography & Fonts'],
                    ['json', 'Public JSON / Manifest'],
                    ['metadata', 'Sitemap & robots.txt'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.assets[key]}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          assets: { ...config.assets, [key]: e.target.checked },
                        })
                      }
                      className="rounded border-zinc-700 bg-zinc-900 text-rose-600 focus:ring-rose-500"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div id="analyzer-security" className="p-4 rounded-xl border border-zinc-800/80 bg-[#121218]">
              <div className="text-xs font-bold text-white mb-2.5">Analyzer & Security Boundaries</div>
              <div className="grid grid-cols-1 gap-2 text-xs text-zinc-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.respectRobotsTxt}
                    onChange={(e) => setConfig({ ...config, respectRobotsTxt: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-900 text-rose-600"
                  />
                  <span>Respect robots.txt directives & rate limits</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.sameDomainOnly}
                    onChange={(e) => setConfig({ ...config, sameDomainOnly: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-900 text-rose-600"
                  />
                  <span>Enforce same-domain link boundary</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.followExternalAssets}
                    onChange={(e) => setConfig({ ...config, followExternalAssets: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-900 text-rose-600"
                  />
                  <span>Inspect CDN stylesheets & public design assets</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeSubdomains}
                    onChange={(e) => setConfig({ ...config, includeSubdomains: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-900 text-rose-600"
                  />
                  <span>Include authorized subdomains</span>
                </label>
              </div>
            </div>
          </div>

          {/* Acceptable Use Policy Confirmation */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-[#121218]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedPolicy}
                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                className="mt-1 rounded border-zinc-700 bg-zinc-900 text-rose-600"
              />
              <div className="text-xs text-zinc-300 leading-relaxed">
                <div className="font-bold text-white flex items-center gap-1.5 mb-0.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authorized Website Analysis Attestation</span>
                </div>
                I confirm that I own this website or have explicit authorization to analyze, archive, or reconstruct its publicly accessible frontend resources. Site Forge AI never captures passwords, cookies, session tokens, or private user credentials.
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{submitting ? 'Initializing Forge Engine...' : 'Analyze Website'}</span>
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
