import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Cpu,
  Code2,
  Download,
  Eye,
  Copy,
  Trash2,
  Folder,
  FileCode,
  Check,
  Search,
  Save,
  Sparkles,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  RefreshCw,
  GitBranch,
  Database,
  Columns,
  FileText,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface ProjectWorkspaceProps {
  projectId: number;
  authToken: string;
  onBack: () => void;
  onProjectDeleted: () => void;
  onProjectDuplicated: (newProjectId: number) => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type WorkspaceTab =
  | 'overview'
  | 'pages'
  | 'assets'
  | 'code'
  | 'recreate'
  | 'diff'
  | 'database'
  | 'versions'
  | 'export';

export function ProjectWorkspace({
  projectId,
  authToken,
  onBack,
  onProjectDeleted,
  onProjectDuplicated,
  onNotify,
}: ProjectWorkspaceProps) {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [activeJobProgress, setActiveJobProgress] = useState<any | null>(null);

  // Code Explorer state
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [fileSearch, setFileSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);
  const [fileAiLoading, setFileAiLoading] = useState<string | null>(null);
  const [fileAiExplanation, setFileAiExplanation] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState(false);

  // AI Recreate & Preview state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiWorking, setAiWorking] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState(0);

  // Database Builder state
  const [dbInstructions, setDbInstructions] = useState('');
  const [dbGenerating, setDbGenerating] = useState(false);

  // Version comparison state
  const [compareVersionId, setCompareVersionId] = useState<number | null>(null);
  const [compareFiles, setCompareFiles] = useState<any[]>([]);

  // Asset filter state
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [inspectedPageHtml, setInspectedPageHtml] = useState<any | null>(null);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load project.');
      setDetails(data);
      if (data.events) setLiveEvents(data.events);
      if (data.jobs?.[0]) setActiveJobProgress(data.jobs[0]);
      if (data.files?.length > 0 && !selectedFileId) {
        setSelectedFileId(data.files[0].id);
        setEditorContent(data.files[0].content);
      }
    } catch (err: any) {
      onNotify(err.message || 'Error loading project', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [projectId]);

  // Connect real-time SSE stream for crawl & AI updates
  useEffect(() => {
    const es = new EventSource(`/api/projects/${projectId}/stream?token=${encodeURIComponent(authToken)}`);
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'crawl_event') {
          setLiveEvents((prev) => [...prev, payload]);
        } else if (payload.type === 'job_progress') {
          setActiveJobProgress((prev: any) => ({ ...(prev || {}), ...payload }));
          if (payload.status === 'completed' || payload.status === 'failed' || payload.status === 'cancelled') {
            fetchDetails();
          }
        } else if (payload.type === 'ai_progress') {
          if (payload.status === 'ready' || payload.status === 'failed') {
            setAiWorking(false);
            fetchDetails();
          }
        }
      } catch {
        // ignore parse errors
      }
    };
    return () => {
      es.close();
    };
  }, [projectId, authToken]);

  const selectedFile = useMemo(() => {
    if (!details?.files) return null;
    return details.files.find((f: any) => f.id === selectedFileId) || details.files[0] || null;
  }, [details, selectedFileId]);

  useEffect(() => {
    if (selectedFile) {
      setEditorContent(selectedFile.content);
      setFileAiExplanation(null);
    }
  }, [selectedFile?.id]);

  if (loading || !details) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-64 bg-slate-800/70 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { project, pages, assets, jobs, analysis, versions, latestVersion, files, aiHistory } = details;
  const latestJob = activeJobProgress || jobs[0] || null;
  const isJobRunning =
    latestJob && ['queued', 'validating', 'crawling', 'analyzing', 'reconstructing', 'packaging'].includes(latestJob.status);

  const technologies = analysis ? JSON.parse(analysis.technologiesJson || '[]') : [];
  const colors = analysis ? JSON.parse(analysis.colorsJson || '[]') : [];
  const fonts = analysis ? JSON.parse(analysis.fontsJson || '[]') : [];
  const breakpoints = analysis ? JSON.parse(analysis.breakpointsJson || '[]') : [];
  const componentsList = analysis ? JSON.parse(analysis.componentsJson || '[]') : [];
  const recommendations = analysis ? JSON.parse(analysis.recommendationsJson || '[]') : [];
  const databaseTables = latestVersion ? JSON.parse(latestVersion.databaseSchemaJson || '[]') : [];

  const handleReanalyze = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveJobProgress(data.job);
      setActiveTab('overview');
      onNotify('Started live website crawl job.', 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleCancelJob = async () => {
    if (!latestJob) return;
    try {
      await fetch(`/api/jobs/${latestJob.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      onNotify('Crawl job cancelled.', 'info');
      fetchDetails();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleRetryJob = async () => {
    if (!latestJob) return;
    try {
      const res = await fetch(`/api/jobs/${latestJob.id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveJobProgress(data.job);
      onNotify('Retrying crawl job...', 'info');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleTogglePageSelection = async (pageId: number) => {
    const currentSelectedIds = pages.filter((p: any) => p.selected).map((p: any) => p.id);
    const nextSelectedIds = currentSelectedIds.includes(pageId)
      ? currentSelectedIds.filter((id: number) => id !== pageId)
      : [...currentSelectedIds, pageId];

    try {
      await fetch(`/api/projects/${projectId}/pages/selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ selectedPageIds: nextSelectedIds }),
      });
      fetchDetails();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleRunAiReconstruction = async (operationType: 'recreate' | 'modify', customPrompt?: string) => {
    setAiWorking(true);
    try {
      const promptToUse = customPrompt !== undefined ? customPrompt : aiPrompt;
      const res = await fetch(`/api/projects/${projectId}/recreate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          prompt: promptToUse,
          operationType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI reconstruction failed.');
      setDetails(data.projectDetails);
      setAiPrompt('');
      setPreviewKey((k) => k + 1);
      onNotify(data.result.summary || 'AI reconstruction completed!', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setAiWorking(false);
    }
  };

  const handleSaveFileContent = async () => {
    if (!selectedFile) return;
    setSavingFile(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${selectedFile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: editorContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onNotify(`Saved changes to ${selectedFile.filePath}`, 'success');
      setEditMode(false);
      fetchDetails();
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSavingFile(false);
    }
  };

  const handleFileAiAction = async (action: 'regenerate' | 'refactor' | 'explain') => {
    if (!selectedFile) return;
    setFileAiLoading(action);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${selectedFile.id}/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFileAiExplanation(data.explanation);
      if (action !== 'explain' && data.updatedContent) {
        setEditorContent(data.updatedContent);
        fetchDetails();
        onNotify(`${action === 'regenerate' ? 'Regenerated' : 'Refactored'} ${selectedFile.filePath}`, 'success');
      }
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setFileAiLoading(null);
    }
  };

  const handleGenerateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/database/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ instructions: dbInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetails(data.projectDetails);
      onNotify('Generated PostgreSQL schema, SQL migrations, and Drizzle ORM models!', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setDbGenerating(false);
    }
  };

  const handleDownloadZip = async (type: 'FULL_ZIP' | 'SOURCE_ONLY' | 'ASSETS_ONLY' = 'FULL_ZIP', versionId?: number) => {
    try {
      onNotify('Packaging and validating ZIP archive...', 'info');
      const query = new URLSearchParams({ type });
      if (versionId) query.set('versionId', String(versionId));
      const res = await fetch(`/api/projects/${projectId}/download?${query.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to download ZIP.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `${safeName}-${type.toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onNotify('ZIP archive downloaded.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDownloadSingleFile = (file: any) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filePath.split('/').pop() || 'file.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReport = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/report`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Report not available.');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-analysis-report.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleOpenPreviewNewTab = () => {
    if (!latestVersion?.previewHtml) return;
    const blob = new Blob([latestVersion.previewHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDuplicateProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onNotify(`Duplicated project as "${data.project.name}"`, 'success');
      onProjectDuplicated(data.project.id);
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDeleteProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to delete project.');
      onNotify('Project deleted.', 'info');
      onProjectDeleted();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleLoadCompareVersion = async (vId: number) => {
    setCompareVersionId(vId);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${vId}/files`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) setCompareFiles(data.files || []);
    } catch {
      // ignore
    }
  };

  const handleRestoreVersion = async (vId: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${vId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetails(data.projectDetails);
      onNotify('Version restored as latest active build.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const filteredFiles = files.filter((f: any) =>
    f.filePath.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredAssets = assets.filter((a: any) =>
    assetFilter === 'all' ? true : a.assetType === assetFilter
  );

  return (
    <div className="space-y-6">
      {/* Top Project Header Bar */}
      <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
              aria-label="Back to projects"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            <span className="text-xs font-mono text-slate-400">
              · {project.status.toUpperCase()} · Score {project.analysisScore}/100
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono pl-9">
            <span>{project.originalUrl}</span>
            <span>·</span>
            <span>{project.pagesDiscovered} pages</span>
            <span>·</span>
            <span>{project.assetsDiscovered} assets</span>
            <span>·</span>
            <span>{(project.projectSizeBytes / 1024).toFixed(1)} KB</span>
            <span>·</span>
            <span>Last analyzed {new Date(project.lastAnalysisAt).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReanalyze}
            disabled={isJobRunning}
            className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Analyze Again</span>
          </button>

          <button
            onClick={() => setActiveTab('recreate')}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recreate with AI</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>View Code ({files.length})</span>
          </button>

          <button
            onClick={() => handleDownloadZip('FULL_ZIP')}
            className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download ZIP</span>
          </button>

          <button
            onClick={handleDuplicateProject}
            className="px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>

          <button
            onClick={handleDeleteProject}
            className="p-2 rounded-lg border border-red-900/50 hover:bg-red-950/50 text-red-400 transition-colors"
            title="Delete Project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Crawl Progress Bar if running or recently completed */}
      {latestJob && (
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1320]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs font-mono">
              {isJobRunning ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              ) : latestJob.status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="text-white font-semibold">{latestJob.currentStep}</span>
              <span className="text-slate-400">
                · {latestJob.pagesProcessed} / {Math.max(latestJob.pagesTotal, 1)} pages · {latestJob.assetsProcessed} /{' '}
                {latestJob.assetsTotal} assets
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isJobRunning && (
                <button
                  onClick={handleCancelJob}
                  className="px-2.5 py-1 rounded bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 text-xs font-medium flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  <span>Cancel Job</span>
                </button>
              )}
              {(latestJob.status === 'failed' || latestJob.status === 'cancelled') && (
                <button
                  onClick={handleRetryJob}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry Job</span>
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                latestJob.status === 'failed'
                  ? 'bg-red-500'
                  : latestJob.status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-indigo-500'
              }`}
              style={{
                width: `${
                  latestJob.status === 'completed'
                    ? 100
                    : Math.min(
                        95,
                        Math.round(
                          ((latestJob.pagesProcessed + latestJob.assetsProcessed) /
                            Math.max(1, latestJob.pagesTotal + latestJob.assetsTotal)) *
                            100
                        )
                      )
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-800 bg-[#0D1320] overflow-x-auto">
        {(
          [
            ['overview', 'Analysis & Crawl Log', Layers],
            ['pages', `Pages & Routes (${pages.length})`, GlobeIcon],
            ['assets', `Assets (${assets.length})`, Folder],
            ['code', `Source Code Explorer (${files.length})`, Code2],
            ['recreate', 'AI Recreate & Live Preview', Sparkles],
            ['diff', 'Original vs. Recreated', Columns],
            ['database', 'Database Builder', Database],
            ['versions', `Versions (${versions.length})`, GitBranch],
            ['export', 'Download & Export', Download],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW, TECH STACK, DESIGN SYSTEM & LIVE CRAWL LOG */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Detected Technologies */}
            <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320]">
              <h2 className="text-sm font-bold text-white mb-3">Detected Technology Stack</h2>
              {technologies.length === 0 ? (
                <p className="text-xs text-slate-400">Analysis in progress...</p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {technologies.map((t: any) => (
                    <div key={t.name} className="py-3 flex items-start justify-between gap-4 text-xs">
                      <div>
                        <div className="font-semibold text-white">{t.name}</div>
                        <div className="text-slate-400 mt-0.5">{t.evidence}</div>
                      </div>
                      <div className="font-mono text-slate-300 shrink-0">
                        {t.category} · <span className="text-indigo-400">{t.confidence}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Design System Tokens: Colors, Typography, Breakpoints */}
            <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-5">
              <h2 className="text-sm font-bold text-white">Extracted Design Tokens & Architecture</h2>

              <div>
                <div className="text-xs text-slate-400 mb-2">Extracted Color Palette</div>
                <div className="flex flex-wrap gap-3">
                  {colors.map((c: any) => (
                    <div
                      key={c.hex}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono"
                    >
                      <span className="w-4 h-4 rounded border border-slate-700" style={{ backgroundColor: c.hex }} />
                      <span className="text-white">{c.hex}</span>
                      <span className="text-slate-500">({c.occurrences})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
                <div>
                  <div className="text-xs text-slate-400 mb-1.5">Typography Families</div>
                  <div className="text-xs font-mono text-slate-200 space-y-1">
                    {fonts.map((f: string) => (
                      <div key={f}>· {f}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1.5">Responsive Breakpoints</div>
                  <div className="text-xs font-mono text-slate-200 space-y-1">
                    {breakpoints.map((bp: string) => (
                      <div key={bp}>· {bp}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80">
                <div className="text-xs text-slate-400 mb-1.5">Detected Component Patterns</div>
                <div className="text-xs text-slate-200 font-mono">
                  {componentsList.join(' · ') || 'Standard Document Structure'}
                </div>
              </div>

              {recommendations.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80">
                  <div className="text-xs text-slate-400 mb-2">AI Reconstruction Recommendations</div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {recommendations.map((rec: string, i: number) => (
                      <li key={i}>
                        {i + 1}. {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Crawl Log Console */}
          <div className="lg:col-span-5">
            <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col h-[540px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="text-sm font-bold text-white">Live Crawler & Analyzer Log</div>
                <span className="text-xs font-mono text-slate-400">{liveEvents.length} events</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-1">
                {liveEvents.length === 0 ? (
                  <div className="text-slate-500">Waiting for crawler events...</div>
                ) : (
                  liveEvents.map((ev: any, idx: number) => (
                    <div key={ev.id || idx} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="text-slate-500 shrink-0 tabular-nums">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={
                          ev.level === 'error'
                            ? 'text-red-400'
                            : ev.level === 'warn'
                            ? 'text-amber-400'
                            : ev.level === 'success'
                            ? 'text-emerald-400'
                            : 'text-slate-300'
                        }
                      >
                        [{ev.step}] {ev.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAGE SELECTION & DISCOVERED ROUTES */}
      {activeTab === 'pages' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">Discovered Website Pages & Route Selection</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select specific pages to include when running AI Reconstruction or exporting Page-Only builds. Authentication routes are sanitized for UI reconstruction only.
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab('recreate');
                  handleRunAiReconstruction(
                    'recreate',
                    `Reconstruct the selected pages (${pages
                      .filter((p: any) => p.selected)
                      .map((p: any) => p.path)
                      .join(', ')}) as modular React components.`
                  );
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white whitespace-nowrap"
              >
                Rebuild Selected Pages with AI
              </button>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">Include</th>
                    <th className="py-2.5 px-3">Route Path</th>
                    <th className="py-2.5 px-3">Page Title</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Security Notice</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pages.map((page: any) => (
                    <tr key={page.id} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={page.selected}
                          onChange={() => handleTogglePageSelection(page.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-300">{page.path}</td>
                      <td className="py-2.5 px-3 text-white font-medium max-w-xs truncate">{page.title}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{page.pageType}</td>
                      <td className="py-2.5 px-3">
                        {page.isAuthUi ? (
                          <span className="text-amber-300 font-mono flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Authentication UI detected (Public layout only)</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Public content route</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                        HTTP {page.statusCode}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setInspectedPageHtml(page)}
                          className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          View HTML
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {inspectedPageHtml && (
            <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="text-xs font-mono text-white">
                  Extracted DOM Snapshot: {inspectedPageHtml.path} ({inspectedPageHtml.title})
                </div>
                <button
                  onClick={() => setInspectedPageHtml(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-80">
                {inspectedPageHtml.htmlContent}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ASSET INVENTORY TABLE */}
      {activeTab === 'assets' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white">Extracted Public Assets ({assets.length})</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Stylesheets, JavaScript bundles, vector graphics, images, and public manifest files discovered during crawling.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
              {(['all', 'css', 'js', 'image', 'svg', 'other'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setAssetFilter(type)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    assetFilter === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Local Project Path</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">MIME Type</th>
                  <th className="py-2.5 px-3 text-right">Size</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                  <th className="py-2.5 px-3">Source URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAssets.map((asset: any) => (
                  <tr key={asset.id} className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 font-mono text-white">{asset.localPath}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-400 uppercase">{asset.assetType}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{asset.mimeType}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                      {(asset.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                      {asset.statusCode || 200}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 max-w-xs truncate">
                      <a href={asset.url} target="_blank" rel="noreferrer" className="hover:text-slate-300">
                        {asset.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: IDE SOURCE CODE EXPLORER & EDITOR */}
      {activeTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[620px]">
          {/* Left File Tree Sidebar */}
          <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-800">
              <div className="text-xs font-bold text-white mb-2 flex items-center justify-between">
                <span>PROJECT EXPLORER</span>
                <span className="font-mono text-slate-400">V{latestVersion?.versionNumber || 1}</span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter files..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-xs">
              {filteredFiles.map((file: any) => {
                const active = selectedFile?.id === file.id;
                return (
                  <button
                    key={file.id}
                    onClick={() => {
                      setSelectedFileId(file.id);
                      setEditMode(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{file.filePath}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                      {(file.sizeBytes / 1024).toFixed(1)}k
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Code Editor & Single-File AI Toolbar */}
          <div className="lg:col-span-9 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-white font-semibold">{selectedFile.filePath}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">{selectedFile.language}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 tabular-nums">{selectedFile.sizeBytes} bytes</span>
                  </div>

                  {/* Editor Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(editorContent);
                        setCopiedFile(true);
                        setTimeout(() => setCopiedFile(false), 1800);
                      }}
                      className="px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-600 text-xs text-slate-200 flex items-center gap-1"
                    >
                      {copiedFile ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedFile ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => handleDownloadSingleFile(selectedFile)}
                      className="px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-600 text-xs text-slate-200 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>

                    <button
                      onClick={() => setEditMode(!editMode)}
                      className={`px-2.5 py-1.5 rounded border text-xs font-medium ${
                        editMode
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                          : 'border-slate-700 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      {editMode ? 'Editing Mode' : 'Edit Code'}
                    </button>

                    {editMode && (
                      <button
                        onClick={handleSaveFileContent}
                        disabled={savingFile}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingFile ? 'Saving...' : 'Save File'}</span>
                      </button>
                    )}

                    {/* Single-File AI Operations */}
                    <button
                      onClick={() => handleFileAiAction('explain')}
                      disabled={Boolean(fileAiLoading)}
                      className="px-2.5 py-1.5 rounded border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs text-indigo-200"
                    >
                      {fileAiLoading === 'explain' ? 'Explaining...' : 'Explain'}
                    </button>
                    <button
                      onClick={() => handleFileAiAction('refactor')}
                      disabled={Boolean(fileAiLoading)}
                      className="px-2.5 py-1.5 rounded border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs text-indigo-200"
                    >
                      {fileAiLoading === 'refactor' ? 'Refactoring...' : 'Refactor'}
                    </button>
                    <button
                      onClick={() => handleFileAiAction('regenerate')}
                      disabled={Boolean(fileAiLoading)}
                      className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{fileAiLoading === 'regenerate' ? 'Regenerating...' : 'Regenerate with AI'}</span>
                    </button>
                  </div>
                </div>

                {fileAiExplanation && (
                  <div className="p-3.5 bg-indigo-950/40 border-b border-indigo-500/30 text-xs text-indigo-100 flex items-start justify-between gap-4">
                    <div className="leading-relaxed">
                      <strong className="text-indigo-300 block mb-1">SiteForge AI File Analysis:</strong>
                      {fileAiExplanation}
                    </div>
                    <button
                      onClick={() => setFileAiExplanation(null)}
                      className="text-indigo-300 hover:text-white shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="flex-1 relative overflow-auto bg-[#080B12]">
                  {editMode ? (
                    <textarea
                      value={editorContent}
                      onChange={(e) => setEditorContent(e.target.value)}
                      spellCheck={false}
                      className="w-full h-full min-h-[520px] p-4 bg-[#080B12] text-xs font-mono text-slate-100 leading-relaxed focus:outline-none resize-none"
                    />
                  ) : (
                    <div className="flex text-xs font-mono leading-relaxed p-4">
                      <div className="select-none pr-4 text-right text-slate-600 border-r border-slate-800/80 mr-4 tabular-nums">
                        {editorContent.split('\n').map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                      <pre className="flex-1 text-slate-200 overflow-x-auto">{editorContent}</pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500">Select a file from the left sidebar to inspect code.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SPLIT-SCREEN AI RECONSTRUCTION WORKSPACE & SANDBOXED PREVIEW */}
      {activeTab === 'recreate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Original Analysis Context + AI Chat & Prompt Box */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1320] p-5 space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white">AI Reconstruction Engine</h2>
                  <p className="text-xs text-slate-400">
                    Active Stack: {latestVersion?.framework || 'React + Tailwind + Vite'}
                  </p>
                </div>
                <span className="text-xs font-mono text-indigo-400">
                  Version {latestVersion?.versionNumber || 1}
                </span>
              </div>

              {/* Extracted Context Summary */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/80 text-xs space-y-1.5">
                <div className="font-semibold text-white">Extracted Source Context Passed to AI:</div>
                <div className="text-slate-400 font-mono">
                  · Selected Pages: {pages.filter((p: any) => p.selected).length} / {pages.length} routes
                </div>
                <div className="text-slate-400 font-mono">
                  · Color Tokens: {colors.slice(0, 4).map((c: any) => c.hex).join(', ')}
                </div>
                <div className="text-slate-400 font-mono">
                  · Detected Stack: {technologies.map((t: any) => t.name).join(', ')}
                </div>
              </div>

              {/* Quick Modification Presets */}
              <div>
                <div className="text-xs text-slate-400 mb-2">Quick Reconstruction & Modification Directives:</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Rebuild full website with modern dark SaaS layout and collapsible sidebar',
                    'Change the primary color to crimson (#DC2626) and refine card spacing',
                    'Add full authentication modal (Login, Signup, Forgot Password) and user profile drawer',
                    'Add interactive pricing comparison matrix and FAQ accordion',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAiPrompt(preset)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-indigo-500/50 text-[11px] text-slate-300 hover:text-white text-left transition-colors"
                    >
                      "{preset}"
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Chat & Modification History */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                <div className="text-xs font-semibold text-slate-400">AI Generation Log ({aiHistory.length})</div>
                {aiHistory.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    Click "Recreate Full Project with AI" or enter a modification prompt below.
                  </div>
                ) : (
                  aiHistory.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-lg border border-slate-800 bg-slate-950 text-xs space-y-1">
                      <div className="flex items-center justify-between text-indigo-400 font-mono">
                        <span>{item.operationType.toUpperCase()}</span>
                        <span>{(item.durationMs / 1000).toFixed(1)}s</span>
                      </div>
                      <div className="text-white font-medium">Prompt: "{item.prompt}"</div>
                      <div className="text-slate-400 leading-relaxed">{item.responseSummary}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom AI Prompt Box */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask AI to rebuild or modify the project (e.g., 'Make the dashboard sidebar collapsible', 'Change primary color to crimson', 'Add authentication')..."
                className="w-full p-3 rounded-lg border border-slate-800 bg-slate-950 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={aiWorking}
                  onClick={() => handleRunAiReconstruction('modify')}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiWorking ? 'AI Reconstructing (Creating New Version)...' : 'Apply AI Modification'}</span>
                </button>
                <button
                  type="button"
                  disabled={aiWorking}
                  onClick={() => handleRunAiReconstruction('recreate')}
                  className="py-2.5 px-3.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-200 hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Full Rebuild
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Isolated Live Preview Panel (Desktop / Tablet / Mobile) */}
          <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col overflow-hidden min-h-[620px]">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Isolated Live Sandbox Preview</span>
                <span className="text-xs font-mono text-slate-400">
                  · Version {latestVersion?.versionNumber || 1}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    onClick={() => setPreviewViewport('desktop')}
                    className={`p-1.5 rounded ${
                      previewViewport === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Desktop Viewport"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewViewport('tablet')}
                    className={`p-1.5 rounded ${
                      previewViewport === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Tablet Viewport (768px)"
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewViewport('mobile')}
                    className={`p-1.5 rounded ${
                      previewViewport === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Mobile Viewport (375px)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
                  title="Refresh Preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleOpenPreviewNewTab}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 overflow-auto">
              <div
                className={`h-full min-h-[540px] bg-white rounded-lg overflow-hidden shadow-2xl border border-slate-800 transition-all ${
                  previewViewport === 'desktop'
                    ? 'w-full'
                    : previewViewport === 'tablet'
                    ? 'w-[768px]'
                    : 'w-[375px]'
                }`}
              >
                <iframe
                  key={previewKey}
                  title="Sandboxed Recreated Website Preview"
                  sandbox="allow-scripts"
                  srcDoc={
                    latestVersion?.previewHtml ||
                    '<html><body style="background:#0f172a;color:#fff;font-family:sans-serif;padding:2rem;">No preview generated yet.</body></html>'
                  }
                  className="w-full h-[540px] border-0"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: WEBSITE DIFFERENCE VIEW (ORIGINAL VS RECREATED) */}
      {activeTab === 'diff' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320]">
            <h2 className="text-sm font-bold text-white mb-1">
              Website Comparison Mode — Original Snapshot vs. AI Recreated Build
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Side-by-side visual and structural comparison between the crawled source HTML and the reconstructed modular application.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                <div className="px-4 py-2.5 border-b border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span>ORIGINAL EXTRACTED DOM ({project.originalUrl})</span>
                  <span>{pages.length} routes</span>
                </div>
                <iframe
                  title="Original Extracted Snapshot"
                  sandbox=""
                  srcDoc={
                    pages[0]?.htmlContent ||
                    '<html><body style="padding:2rem;font-family:sans-serif;">No raw HTML snapshot available.</body></html>'
                  }
                  className="w-full h-96 bg-white border-0"
                />
              </div>

              <div className="rounded-xl border border-indigo-500/40 overflow-hidden bg-slate-950">
                <div className="px-4 py-2.5 border-b border-slate-800 text-xs font-mono text-indigo-300 flex items-center justify-between">
                  <span>RECREATED APPLICATION (Version {latestVersion?.versionNumber || 1})</span>
                  <span>{files.length} modular files</span>
                </div>
                <iframe
                  title="Recreated Build Preview"
                  sandbox="allow-scripts"
                  srcDoc={latestVersion?.previewHtml || ''}
                  className="w-full h-96 bg-white border-0"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: AI DATABASE SCHEMA BUILDER */}
      {activeTab === 'database' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
            <h2 className="text-sm font-bold text-white">AI Database Schema Builder</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generate a new PostgreSQL relational schema, SQL migration files, and Drizzle ORM models tailored to the observable features of this website.
            </p>
            <form onSubmit={handleGenerateDatabase} className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Domain & Entity Requirements (Optional)
              </label>
              <textarea
                rows={4}
                value={dbInstructions}
                onChange={(e) => setDbInstructions(e.target.value)}
                placeholder="e.g., Include tables for users, organizations, subscriptions, invoices, and role-based access control."
                className="w-full p-3 rounded-lg border border-slate-800 bg-slate-950 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={dbGenerating}
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{dbGenerating ? 'Generating Schema & Migrations...' : 'Generate Database with AI'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                Visual Relational Schema ({databaseTables.length} Tables)
              </h3>
              <button
                onClick={() => setActiveTab('code')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Inspect SQL Migrations in Code Explorer →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {databaseTables.map((table: any) => (
                <div key={table.tableName} className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs">
                  <div className="font-bold text-indigo-400 pb-2 mb-2 border-b border-slate-800 flex items-center justify-between">
                    <span>{table.tableName}</span>
                    <span className="text-[10px] text-slate-500">{table.columns?.length || 0} cols</span>
                  </div>
                  <div className="space-y-1.5">
                    {(table.columns || []).map((col: any) => (
                      <div key={col.name} className="flex items-center justify-between gap-2">
                        <span className="text-white">├── {col.name}</span>
                        <span className="text-slate-400 text-[11px]">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: VERSION TIMELINE & ROLLBACK */}
      {activeTab === 'versions' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-5">
          <div>
            <h2 className="text-sm font-bold text-white">Version History & Rollback</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Every AI reconstruction or edit creates an immutable version snapshot so your previous work is never overwritten.
            </p>
          </div>

          <div className="space-y-3">
            {versions.map((ver: any, index: number) => (
              <div
                key={ver.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  index === 0 ? 'border-indigo-500/50 bg-indigo-950/15' : 'border-slate-800 bg-slate-950'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{ver.versionLabel}</span>
                    {index === 0 && (
                      <span className="text-xs font-mono text-emerald-400">· Active Build</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">Prompt: "{ver.promptUsed}"</div>
                  <div className="text-xs font-mono text-slate-500">
                    {ver.framework} · Created {new Date(ver.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleLoadCompareVersion(ver.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-xs text-slate-200"
                  >
                    Inspect Files
                  </button>
                  <button
                    onClick={() => handleDownloadZip('FULL_ZIP', ver.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 text-xs text-slate-200"
                  >
                    Download ZIP
                  </button>
                  {index > 0 && (
                    <button
                      onClick={() => handleRestoreVersion(ver.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                    >
                      Restore Version
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {compareVersionId && compareFiles.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white font-mono">
                  SNAPSHOT FILES ({compareFiles.length} files)
                </h3>
                <button
                  onClick={() => setCompareVersionId(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close Snapshot View
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {compareFiles.slice(0, 4).map((f: any) => (
                  <div key={f.id} className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                    <div className="text-xs font-mono text-indigo-400 mb-2">{f.filePath}</div>
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
                      {f.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: DOWNLOAD & EXPORT OPTIONS */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Download Entire Project (.ZIP)',
              desc: 'Complete archive containing generated React/TypeScript source, migrations, extracted assets, README.md, and .env.example.',
              action: () => handleDownloadZip('FULL_ZIP'),
              primary: true,
            },
            {
              title: 'Download Source Code Only (.ZIP)',
              desc: 'Clean modular application source tree (src/, package.json, migrations/, README.md) without raw HTML snapshots.',
              action: () => handleDownloadZip('SOURCE_ONLY'),
            },
            {
              title: 'Download Extracted Assets (.ZIP)',
              desc: 'Extracted stylesheets, scripts, vectors, and media files discovered during the website crawl.',
              action: () => handleDownloadZip('ASSETS_ONLY'),
            },
            {
              title: 'Download Analysis Report (.MD)',
              desc: 'Comprehensive Markdown architecture report with detected stack, routes, color tokens, and recommendations.',
              action: handleDownloadReport,
            },
          ].map((card) => (
            <div
              key={card.title}
              className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col justify-between space-y-4"
            >
              <div>
                <h3 className="text-sm font-bold text-white mb-2">{card.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
              </div>
              <button
                onClick={card.action}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  card.primary
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobeIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
