import React, { useState } from 'react';
import { Globe, ShieldCheck, Sliders, X, Play, Layers, Cpu, Download, FileCode } from 'lucide-react';
import { DEFAULT_CRAWL_CONFIG, CrawlConfig } from '../shared/types.ts';

interface UrlAnalyzerModalProps {
  isOpen: boolean;
  initialUrl?: string;
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
  onClose,
  onStartProject,
}: UrlAnalyzerModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'DOWNLOAD' | 'ANALYZE' | 'RECREATE' | 'PAGE_ONLY'>('ANALYZE');
  const [config, setConfig] = useState<CrawlConfig>({ ...DEFAULT_CRAWL_CONFIG });
  const [customUrlsText, setCustomUrlsText] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  if (!isOpen) return null;

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
      id: 'DOWNLOAD' as const,
      title: 'MODE A — DOWNLOAD',
      desc: 'Extract authorized public HTML, CSS, JS, and media into a downloadable ZIP project.',
      icon: Download,
    },
    {
      id: 'ANALYZE' as const,
      title: 'MODE B — ANALYZE',
      desc: 'Inspect routes, frameworks, CSS architecture, color palette, typography, and assets.',
      icon: Layers,
    },
    {
      id: 'RECREATE' as const,
      title: 'MODE C — RECREATE',
      desc: 'Analyze structure and reconstruct a clean, modular React + Tailwind application with AI.',
      icon: Cpu,
    },
    {
      id: 'PAGE_ONLY' as const,
      title: 'MODE D — PAGE ONLY',
      desc: 'Target a specific route (Landing, Pricing, Dashboard, or Auth UI layout) for export.',
      icon: FileCode,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analyzer-config-title"
    >
      <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-[#0D1320] p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 id="analyzer-config-title" className="text-lg font-bold text-white">
                Configure Website Analysis & Extraction
              </h2>
              <p className="text-xs text-slate-400">
                Define crawl boundaries, asset extraction rules, and reconstruction mode.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close configurator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-5">
          {/* URL & Project Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Website URL</label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-800 bg-slate-950 text-sm font-mono text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Project Name (Optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-detected from domain"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-950 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 4 Selectable Analysis Modes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Analysis & Operation Mode</label>
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
                      }
                    }}
                    className={`p-3.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-white mb-1">
                      <Icon className="w-4 h-4 text-indigo-400" />
                      <span>{m.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope & Extraction Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Analysis Scope</label>
              <select
                value={config.scope}
                onChange={(e) => setConfig({ ...config, scope: e.target.value as CrawlConfig['scope'] })}
                className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="SAME_DOMAIN">Same-Domain Pages</option>
                <option value="ENTIRE">Entire Website (Up to Limit)</option>
                <option value="SINGLE_PAGE">Single Page Only</option>
                <option value="SELECTED_PAGES">Selected Pages (Choose After Discovery)</option>
                <option value="CUSTOM_LIST">Custom URL List</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Extraction Pipeline</label>
              <select
                value={config.extractionMode}
                onChange={(e) =>
                  setConfig({ ...config, extractionMode: e.target.value as CrawlConfig['extractionMode'] })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="DEEP_ANALYSIS">Deep Website Analysis</option>
                <option value="STATIC_MIRROR">Static Mirror Extraction</option>
                <option value="FRONTEND_ANALYSIS">Frontend Component Analysis</option>
                <option value="AI_RECONSTRUCTION">AI Reconstruction Analysis</option>
              </select>
            </div>
          </div>

          {config.scope === 'CUSTOM_LIST' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Custom Relative Paths or Same-Domain URLs (one per line)
              </label>
              <textarea
                rows={3}
                value={customUrlsText}
                onChange={(e) => setCustomUrlsText(e.target.value)}
                placeholder="/pricing&#10;/about&#10;/docs"
                className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {/* Crawl Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max Pages</label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.maxPages}
                onChange={(e) => setConfig({ ...config, maxPages: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max Crawl Depth</label>
              <input
                type="number"
                min={0}
                max={5}
                value={config.maxDepth}
                onChange={(e) => setConfig({ ...config, maxDepth: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max File Size (KB)</label>
              <input
                type="number"
                min={128}
                max={10240}
                value={config.maxFileSizeKb}
                onChange={(e) => setConfig({ ...config, maxFileSizeKb: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-sm font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Request Delay (ms)</label>
              <input
                type="number"
                min={0}
                max={2000}
                step={50}
                value={config.requestDelayMs}
                onChange={(e) => setConfig({ ...config, requestDelayMs: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-sm font-mono text-white"
              />
            </div>
          </div>

          {/* Asset Options & Crawl Flags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <div className="text-xs font-medium text-slate-300 mb-2">Asset Extraction Filters</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                {(
                  [
                    ['html', 'HTML Documents'],
                    ['css', 'CSS Stylesheets'],
                    ['js', 'JavaScript Bundles'],
                    ['images', 'Images & Media'],
                    ['svg', 'SVG Icons & Vectors'],
                    ['fonts', 'Web Fonts'],
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
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-300 mb-2">Crawler Behavior Rules</div>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.respectRobotsTxt}
                    onChange={(e) => setConfig({ ...config, respectRobotsTxt: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <span>Respect robots.txt directives & crawl boundaries</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeSubdomains}
                    onChange={(e) => setConfig({ ...config, includeSubdomains: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <span>Include authorized subdomains</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.followExternalAssets}
                    onChange={(e) => setConfig({ ...config, followExternalAssets: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <span>Fetch CDN & external stylesheets/assets</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.stopOnError}
                    onChange={(e) => setConfig({ ...config, stopOnError: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <span>Stop crawl immediately on HTTP error</span>
                </label>
              </div>
            </div>
          </div>

          {/* Acceptable Use Policy Confirmation */}
          <div className="p-3.5 rounded-lg border border-indigo-500/30 bg-indigo-950/20">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedPolicy}
                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                className="mt-1 rounded border-slate-700 bg-slate-900 text-indigo-600"
              />
              <div className="text-xs text-slate-300 leading-relaxed">
                <div className="font-semibold text-white flex items-center gap-1.5 mb-0.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Acceptable Use & Authorization Attestation</span>
                </div>
                I confirm that I own this website or have explicit authorization to analyze, archive, or reconstruct its publicly accessible frontend resources. SiteForge AI sanitizes authentication inputs and never harvests credentials or private backend databases.
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 shadow-lg transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{submitting ? 'Starting Crawler Job...' : 'Start Live Analysis'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
