/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import { LandingPage } from './components/LandingPage.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { ProjectWorkspace } from './components/ProjectWorkspace.tsx';
import avatarImg from './assets/images/avatar_lead_architect_1791108667216.jpg';
import {
  Globe,
  FolderGit2,
  Activity,
  Sparkles,
  Code2,
  Download,
  Settings,
  CreditCard,
  HelpCircle,
  Bell,
  Plus,
  Search,
  LogOut,
  Menu,
  X,
  Check,
  Trash2,
  ExternalLink,
  RotateCcw,
  Square,
  GitBranch,
} from 'lucide-react';

type DashboardSection =
  | 'analyze'
  | 'projects'
  | 'crawls'
  | 'ai-rebuilds'
  | 'generated-code'
  | 'downloads'
  | 'settings'
  | 'billing'
  | 'help'
;

function App() {
  // Auth & Session state (stored in memory per security guidelines)
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem('siteforge_auth_token');
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);

  // View routing state
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>(() => (authToken ? 'dashboard' : 'landing'));
  const [activeSection, setActiveSection] = useState<DashboardSection>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openRecreateRequest, setOpenRecreateRequest] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [pendingAnalyzePayload, setPendingAnalyzePayload] = useState<any | null>(null);
  const [landingAnalysis, setLandingAnalysis] = useState<{ projectId: number | null; job: any | null; events: any[]; error: string | null }>({ projectId: null, job: null, events: [], error: null });

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState<{
    stats: {
      projectsCount: number;
      activeJobsCount: number;
      completedAnalysesCount: number;
      generatedWebsitesCount: number;
      downloadsCount: number;
      totalStorageBytes: number;
    };
    projects: any[];
    jobs: any[];
    aiGenerations: any[];
    downloads: any[];
  }>({
    stats: {
      projectsCount: 0,
      activeJobsCount: 0,
      completedAnalysesCount: 0,
      generatedWebsitesCount: 0,
      downloadsCount: 0,
      totalStorageBytes: 0,
    },
    projects: [],
    jobs: [],
    aiGenerations: [],
    downloads: [],
  });

  // Search & Filter state for Projects
  const [projectSearch, setProjectSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');

  // Notifications & Toast
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Account Settings state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Sync Firebase Auth listener & URL/PostMessage GitHub OAuth handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghToken = params.get('github_token');
    if (ghToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthToken(ghToken);
      setViewMode('dashboard');
      loadUserProfileAndDashboard(ghToken);
      showToast('Authenticated with GitHub!', 'success');
    }

    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.endsWith('.onrender.com') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token) {
        setAuthToken(event.data.token);
        if (event.data.user) setCurrentUser(event.data.user);
        setViewMode('dashboard');
        loadUserProfileAndDashboard(event.data.token);
        showToast(
          event.data.user?.githubUsername
            ? `Connected GitHub as @${event.data.user.githubUsername}`
            : 'GitHub connected!',
          'success'
        );
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        showToast(event.data.error || 'GitHub OAuth error.', 'error');
      }
    };
    window.addEventListener('message', handleOAuthMessage);

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && !authToken && !ghToken) {
        try {
          const token = await fbUser.getIdToken();
          await loadUserProfileAndDashboard(token);
        } catch {
          // ignore
        }
      }
    });
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      unsub();
    };
  }, []);

  const loadUserProfileAndDashboard = async (token: string) => {
    setDashboardLoading(true);
    setDashboardLoadError(null);
    try {
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) {
        setDashboardLoadError(`Your session could not be loaded (HTTP ${meRes.status}). Please sign in again.`);
        return;
      }

      const meData = await meRes.json();
      if (!meData?.user) {
        setDashboardLoadError('The server returned an invalid account response. Please sign in again.');
        return;
      }

      setAuthToken(token);
      try { window.sessionStorage.setItem('siteforge_auth_token', token); } catch {}
      setCurrentUser(meData.user);
      setSubscription(meData.subscription ?? null);
      setNotificationsList(Array.isArray(meData.notifications) ? meData.notifications : []);

      const dashRes = await fetch('/api/dashboard/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dashRes.ok) {
        const dashJson = await dashRes.json();
        setDashboardData({
          stats: {
            projectsCount: Number(dashJson?.stats?.projectsCount ?? 0),
            activeJobsCount: Number(dashJson?.stats?.activeJobsCount ?? 0),
            completedAnalysesCount: Number(dashJson?.stats?.completedAnalysesCount ?? 0),
            generatedWebsitesCount: Number(dashJson?.stats?.generatedWebsitesCount ?? 0),
            downloadsCount: Number(dashJson?.stats?.downloadsCount ?? 0),
            totalStorageBytes: Number(dashJson?.stats?.totalStorageBytes ?? 0),
          },
          projects: Array.isArray(dashJson?.projects) ? dashJson.projects : [],
          jobs: Array.isArray(dashJson?.jobs) ? dashJson.jobs : [],
          aiGenerations: Array.isArray(dashJson?.aiGenerations) ? dashJson.aiGenerations : [],
          downloads: Array.isArray(dashJson?.downloads) ? dashJson.downloads : [],
        });
      } else {
        // Authentication succeeded even if dashboard telemetry is temporarily unavailable.
        // Keep the workspace usable instead of rendering a blank screen.
        setDashboardLoadError(`Your account is signed in, but dashboard data is temporarily unavailable (HTTP ${dashRes.status}).`);
      }
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      setDashboardLoadError(err?.message || 'Unable to load the workspace.');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      loadUserProfileAndDashboard(authToken);
    }
  }, [authToken, selectedProjectId, activeSection]);

  const handleAuthSuccess = async (token: string, user?: any) => {
    setAuthToken(token);
    try { window.sessionStorage.setItem('siteforge_auth_token', token); } catch {}
    if (user) setCurrentUser(user);
    setViewMode('dashboard');
    setActiveSection('projects');
    await loadUserProfileAndDashboard(token);

    if (pendingAnalyzePayload) {
      const payload = pendingAnalyzePayload;
      setPendingAnalyzePayload(null);
      await createAndStartProject(payload, token);
    }
  };

  const handleLogout = async () => {
    if (authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    await signOut(auth).catch(() => {});
    setAuthToken(null);
    try { window.sessionStorage.removeItem('siteforge_auth_token'); } catch {}
    setCurrentUser(null);
    setSelectedProjectId(null);
    setViewMode('landing');
    showToast('Signed out successfully.', 'info');
  };

  const createAndStartProject = async (payload: any, tokenOverride?: string) => {
    const tokenToUse = tokenOverride || authToken;
    if (!tokenToUse) {
      setPendingAnalyzePayload(payload);
      setAuthModalInitialMode('login');
      setAuthModalOpen(true);
      return;
    }

    const { returnToLanding, ...requestPayload } = payload || {};
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenToUse}`,
      },
      body: JSON.stringify(requestPayload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create project.');
    }
    await loadUserProfileAndDashboard(tokenToUse);
    if (returnToLanding) {
      setLandingAnalysis({ projectId: data.project.id, job: data.job || null, events: [], error: null });
      setSelectedProjectId(null);
      setViewMode('landing');
      showToast(`Started analysis of ${data.project.originalUrl}`, 'success');
    } else {
      setViewMode('dashboard');
      setSelectedProjectId(data.project.id);
      showToast(`Started analysis of ${data.project.originalUrl}`, 'success');
    }
  };

  const handleLandingStart = async (payload: any) => {
    await createAndStartProject({ ...payload, returnToLanding: true });
  };

  useEffect(() => {
    if (!landingAnalysis.projectId || !authToken) return;
    let cancelled = false;
    const projectId = landingAnalysis.projectId;

    const loadInitial = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${authToken}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load analysis progress.');
        if (cancelled) return;
        setLandingAnalysis((prev) => ({
          ...prev,
          job: data.jobs?.[0] || prev.job,
          events: Array.isArray(data.events) ? data.events : prev.events,
        }));
      } catch (err: any) {
        if (!cancelled) setLandingAnalysis((prev) => ({ ...prev, error: err.message || 'Unable to load analysis progress.' }));
      }
    };
    loadInitial();

    const es = new EventSource(`/api/projects/${projectId}/stream?token=${encodeURIComponent(authToken)}`);
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (cancelled) return;
        if (payload.type === 'crawl_event') {
          setLandingAnalysis((prev) => ({ ...prev, events: prev.events.some((item) => item.id === payload.id) ? prev.events : [...prev.events, payload] }));
        } else if (payload.type === 'job_progress') {
          setLandingAnalysis((prev) => ({ ...prev, job: { ...(prev.job || {}), ...payload }, error: payload.status === 'failed' ? (payload.errorMessage || 'The server-side analysis failed.') : prev.error }));
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };
    es.onerror = () => {
      // EventSource reconnects automatically. Do not show a false failure while the worker continues.
    };
    return () => {
      cancelled = true;
      es.close();
    };
  }, [landingAnalysis.projectId, authToken]);

  const handleLandingDownload = async () => {
    if (!landingAnalysis.projectId || !authToken || landingAnalysis.job?.status !== 'completed') return;
    const res = await fetch(`/api/projects/${landingAnalysis.projectId}/download?type=FULL_ZIP`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'The ZIP could not be downloaded.', 'error');
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const fileName = match?.[1] || 'siteforge-export.zip';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${fileName}`, 'success');
  };

  const handleMarkNotificationsRead = async () => {
    if (!authToken) return;
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    setNotificationsList((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleChangePlan = async (tier: string) => {
    if (!authToken) return;
    const res = await fetch('/api/billing/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ tier }),
    });
    if (res.ok) {
      loadUserProfileAndDashboard(authToken);
      showToast(`Subscription updated to ${tier} plan.`, 'success');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password updated successfully.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (!authToken) return;
    const res = await fetch('/api/auth/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      setConfirmDeleteOpen(false);
      handleLogout();
    }
  };

  const handleConnectGithub = async () => {
    try {
      const origin = window.location.origin;
      const res = await fetch(`/api/auth/github/url?origin=${encodeURIComponent(origin)}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await res.json();
      if (res.status === 503 && data.configurationError) {
        showToast(
          `${data.error} Set Callback URL: ${data.callbackUrl || `${origin}/auth/github/callback`}`,
          'error'
        );
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to initiate GitHub OAuth.');
      }
      const popup = window.open(data.url, 'github_oauth_popup', 'width=600,height=720');
      if (!popup) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to connect GitHub.', 'error');
    }
  };

  const handleDisconnectGithub = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/github/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to disconnect GitHub.');
      await loadUserProfileAndDashboard(authToken);
      showToast('Disconnected GitHub account and cleared encrypted token.', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredProjects = useMemo(() => {
    return dashboardData.projects.filter((p) => {
      const matchesSearch =
        String(p?.name ?? '').toLowerCase().includes(projectSearch.toLowerCase()) ||
        String(p?.originalUrl ?? '').toLowerCase().includes(projectSearch.toLowerCase()) ||
        String(p?.technologiesJson ?? '').toLowerCase().includes(projectSearch.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : p.status === statusFilter;
      const matchesMode = modeFilter === 'all' ? true : p.mode === modeFilter;
      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [dashboardData.projects, projectSearch, statusFilter, modeFilter]);

  const unreadCount = notificationsList.filter((n) => !n.isRead).length;
  const navItems: { id: DashboardSection; label: string; icon: any }[] = [
    { id: 'analyze', label: 'Analyze Website', icon: Globe },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'crawls', label: 'Crawls & Jobs', icon: Activity },
    { id: 'ai-rebuilds', label: 'AI Rebuilds', icon: Sparkles },
    { id: 'generated-code', label: 'Generated Code', icon: Code2 },
    { id: 'downloads', label: 'Downloads', icon: Download },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'help', label: 'Help & Docs', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100">
      {/* Global Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium flex items-center gap-3 ${
            toast.type === 'error'
              ? 'border-red-500/50 bg-red-950/95 text-red-100'
              : toast.type === 'success'
              ? 'border-emerald-500/50 bg-emerald-950/95 text-emerald-100'
              : 'border-indigo-500/50 bg-[#0F1624] text-white'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Auth & URL Analyzer Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* VIEW 1: LANDING PAGE */}
      {viewMode === 'landing' && (
        <LandingPage
          isAuthenticated={Boolean(authToken)}
          analysisState={landingAnalysis}
          onStartAnalysis={handleLandingStart}
          onDownloadZip={handleLandingDownload}
          onRecreateWithAI={() => {
            if (!landingAnalysis.projectId || landingAnalysis.job?.status !== 'completed') return;
            if (!authToken) {
              setAuthModalInitialMode('login');
              setAuthModalOpen(true);
              return;
            }
            setOpenRecreateRequest((n) => n + 1);
            setSelectedProjectId(landingAnalysis.projectId);
            setActiveSection('projects');
            setViewMode('dashboard');
          }}
          onOpenAuth={(mode) => {
            setAuthModalInitialMode(mode);
            setAuthModalOpen(true);
          }}
          onNavigateDashboard={() => setViewMode('dashboard')}
        />
      )}

      {/* VIEW 2: SAAS DASHBOARD WORKSPACE */}
      {viewMode === 'dashboard' && (
        <div className="min-h-screen flex flex-col lg:flex-row">
          {/* Desktop Sidebar (260px width) */}
          <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-slate-800/80 bg-[#0B101B] shrink-0">
            <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedProjectId(null);
                  setActiveSection('projects');
                }}
                className="text-lg font-bold tracking-tight text-white font-display"
              >
                SiteForge AI
              </button>
              <button
                onClick={() => setViewMode('landing')}
                className="text-[11px] text-slate-400 hover:text-white font-mono"
              >
                Home
              </button>
            </div>

            <div className="p-4">
              <button
                onClick={() => {
                  setSelectedProjectId(null);
                  setViewMode('landing');
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Analyze Website</span>
              </button>
            </div>

            <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = !selectedProjectId && activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'analyze') {
                        setSelectedProjectId(null);
                        setViewMode('landing');
                        return;
                      }
                      setSelectedProjectId(null);
                      setActiveSection(item.id);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors ${
                      active
                        ? 'bg-indigo-600/15 text-white border border-indigo-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {currentUser && (
              <div className="p-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={currentUser.githubAvatarUrl || avatarImg}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {currentUser.githubConnected && currentUser.githubUsername
                        ? `@${currentUser.githubUsername} · ${currentUser.plan}`
                        : `${currentUser.plan} · ${currentUser.role}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </aside>

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Workspace Header */}
            <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#090D16]/90 backdrop-blur px-6 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-lg border border-slate-800 text-slate-300"
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="text-xs font-mono text-slate-400">
                  <span
                    onClick={() => {
                      setSelectedProjectId(null);
                      setActiveSection('projects');
                    }}
                    className="hover:text-white cursor-pointer"
                  >
                    Workspace
                  </span>
                  <span className="mx-2">/</span>
                  <span className="text-white font-semibold">
                    {selectedProjectId ? `Project #${selectedProjectId}` : activeSection.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Notification Center */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifDropdownOpen(!notifDropdownOpen);
                      if (unreadCount > 0) handleMarkNotificationsRead();
                    }}
                    className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white relative"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {notifDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-800 bg-[#0F1624] shadow-2xl p-4 z-40">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-2.5">
                        <span className="text-xs font-bold text-white">Notifications</span>
                        <button
                          onClick={() => setNotifDropdownOpen(false)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Close
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {notificationsList.length === 0 ? (
                          <div className="text-xs text-slate-500 py-4 text-center">No notifications yet.</div>
                        ) : (
                          notificationsList.map((n) => (
                            <button key={n.id} type="button" onClick={() => { setSelectedNotification(n); setNotifDropdownOpen(false); }} className="w-full text-left p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs hover:border-indigo-500/40 hover:bg-slate-900 transition-colors">
                              <div className="flex items-center justify-between gap-3"><div className="font-semibold text-white">{n.title}</div>{!n.isRead && <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />}</div>
                              <div className="text-slate-400 mt-1 leading-relaxed line-clamp-2">{n.message}</div>
                              <div className="text-[10px] font-mono text-slate-500 mt-2">{new Date(n.createdAt).toLocaleString()}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedProjectId(null);
                              setViewMode('landing');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Analysis</span>
                </button>
              </div>
            </header>

            {/* Mobile Drawer Navigation */}
            {mobileMenuOpen && (
              <div className="lg:hidden border-b border-slate-800 bg-[#0B101B] p-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (item.id === 'analyze') {
                          setSelectedProjectId(null);
                          setViewMode('landing');
                          return;
                        }
                        setSelectedProjectId(null);
                        setActiveSection(item.id);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5"
                    >
                      <Icon className="w-4 h-4 text-indigo-400" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedNotification && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="notification-title">
                <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0D1320] shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3"><Bell className="w-5 h-5 text-indigo-400" /><h2 id="notification-title" className="text-base font-bold text-white">{selectedNotification.title}</h2></div>
                    <button type="button" onClick={() => setSelectedNotification(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close notification"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-5 space-y-3"><p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{selectedNotification.message}</p><div className="text-xs font-mono text-slate-500">{new Date(selectedNotification.createdAt).toLocaleString()}</div></div>
                </div>
              </div>
            )}

            {/* Main Viewport Content */}
            <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
              {dashboardLoading && (
                <div className="mb-5 rounded-xl border border-slate-800 bg-[#0D1320] px-4 py-3 text-xs text-slate-300" role="status">
                  Loading your SiteForge AI workspace…
                </div>
              )}
              {dashboardLoadError && (
                <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" role="alert">
                  <span>{dashboardLoadError}</span>
                  <button
                    type="button"
                    onClick={() => authToken && loadUserProfileAndDashboard(authToken)}
                    className="shrink-0 rounded-lg border border-amber-500/30 px-3 py-1.5 font-semibold hover:bg-amber-500/10"
                  >
                    Retry
                  </button>
                </div>
              )}
              {selectedProjectId && authToken ? (
                <ProjectWorkspace
                  projectId={selectedProjectId}
                  authToken={authToken}
                  currentUser={currentUser}
                  openRecreateRequest={openRecreateRequest}
                  onConnectGithub={handleConnectGithub}
                  onBack={() => setSelectedProjectId(null)}
                  onProjectDeleted={() => {
                    setSelectedProjectId(null);
                    loadUserProfileAndDashboard(authToken);
                  }}
                  onProjectDuplicated={(newId) => {
                    loadUserProfileAndDashboard(authToken);
                    setSelectedProjectId(newId);
                  }}
                  onNotify={showToast}
                />
              ) : (
                <>
                  {/* SECTION: PROJECTS (WITH SEARCH & FILTERS) */}
                  {activeSection === 'projects' && (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h1 className="text-xl font-bold text-white">Projects Directory ({filteredProjects.length})</h1>
                          <p className="text-xs text-slate-400">
                            Search and filter by status, extraction mode, or detected technology stack.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={projectSearch}
                              onChange={(e) => setProjectSearch(e.target.value)}
                              placeholder="Search URL, name, tech..."
                              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 bg-[#0D1320] text-xs text-white focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0D1320] text-xs text-white"
                          >
                            <option value="all">All Statuses</option>
                            <option value="completed">Completed</option>
                            <option value="crawling">Crawling</option>
                            <option value="failed">Failed</option>
                          </select>
                          <select
                            value={modeFilter}
                            onChange={(e) => setModeFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0D1320] text-xs text-white"
                          >
                            <option value="all">All Modes</option>
                            <option value="ANALYZE">Analyze</option>
                            <option value="DOWNLOAD">Download</option>
                            <option value="RECREATE">Recreate</option>
                            <option value="PAGE_ONLY">Page Only</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProjects.map((p) => {
                          let techs: any[] = [];
                          try {
                            techs = JSON.parse(p.technologiesJson || '[]');
                          } catch {
                            techs = [];
                          }
                          return (
                            <div
                              key={p.id}
                              className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                                  <span>{p.mode}</span>
                                  <span
                                    className={
                                      p.status === 'completed'
                                        ? 'text-emerald-400'
                                        : p.status === 'failed'
                                        ? 'text-red-400'
                                        : 'text-amber-400'
                                    }
                                  >
                                    {p.status.toUpperCase()}
                                  </span>
                                </div>
                                <h3 className="text-base font-bold text-white truncate">{p.name}</h3>
                                <div className="text-xs font-mono text-indigo-300 truncate">{p.originalUrl}</div>
                                <div className="text-xs font-mono text-slate-400 tabular-nums">
                                  {p.pagesDiscovered} pages · {p.assetsDiscovered} assets ·{' '}
                                  {(p.projectSizeBytes / 1024).toFixed(1)} KB
                                </div>
                                {techs.length > 0 && (
                                  <div className="text-[11px] font-mono text-slate-500 truncate">
                                    Stack: {techs.map((t) => t.name).join(' · ')}
                                  </div>
                                )}
                                {p.githubRepositoryUrl && (
                                  <a
                                    href={p.githubRepositoryUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 hover:underline pt-1"
                                  >
                                    <GitBranch className="w-3 h-3" />
                                    <span>
                                      {p.githubUsername ? `${p.githubUsername}/` : ''}
                                      {p.githubRepositoryName}
                                    </span>
                                  </a>
                                )}
                              </div>

                              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                                <button
                                  onClick={() => setSelectedProjectId(p.id)}
                                  className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                                >
                                  Open Project
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SECTION: CRAWLS & JOBS */}
                  {activeSection === 'crawls' && (
                    <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
                      <h1 className="text-lg font-bold text-white">Background Crawl & Analysis Jobs</h1>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2.5 px-3">Job ID</th>
                              <th className="py-2.5 px-3">Project</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Progress</th>
                              <th className="py-2.5 px-3">Current Step / Error</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {dashboardData.jobs.map((job) => (
                              <tr key={job.id}>
                                <td className="py-2.5 px-3 font-mono text-slate-400">#{job.id}</td>
                                <td className="py-2.5 px-3">
                                  <button
                                    onClick={() => setSelectedProjectId(job.projectId)}
                                    className="font-mono text-indigo-400 hover:underline"
                                  >
                                    Project #{job.projectId}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 font-mono uppercase text-white">{job.status}</td>
                                <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300">
                                  {job.pagesProcessed}/{job.pagesTotal} pages · {job.assetsProcessed}/{job.assetsTotal} assets
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">{job.errorMessage || job.currentStep}</td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => setSelectedProjectId(job.projectId)}
                                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                                  >
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SECTION: AI REBUILDS & GENERATED CODE */}
                  {(activeSection === 'ai-rebuilds' || activeSection === 'generated-code') && (
                    <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
                      <h1 className="text-lg font-bold text-white">
                        {activeSection === 'ai-rebuilds'
                          ? 'AI Reconstructions & Modifications'
                          : 'Generated Project Repositories'}
                      </h1>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dashboardData.projects.map((p) => (
                          <div key={p.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-bold text-white">{p.name}</div>
                              <div className="text-xs font-mono text-slate-400 mt-0.5">{p.originalUrl}</div>
                              <div className="text-xs font-mono text-indigo-400 mt-1">
                                AI Status: {p.aiStatus.toUpperCase()}
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedProjectId(p.id)}
                              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white whitespace-nowrap"
                            >
                              Open Code & AI Workspace
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION: DOWNLOADS HISTORY */}
                  {activeSection === 'downloads' && (
                    <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
                      <h1 className="text-lg font-bold text-white">Validated ZIP Archive Downloads</h1>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2.5 px-3">Archive File Name</th>
                              <th className="py-2.5 px-3">Export Type</th>
                              <th className="py-2.5 px-3 text-right">Size</th>
                              <th className="py-2.5 px-3 text-right">Timestamp</th>
                              <th className="py-2.5 px-3 text-right">Project</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {dashboardData.downloads.map((d) => (
                              <tr key={d.id}>
                                <td className="py-2.5 px-3 font-mono text-white">{d.fileName}</td>
                                <td className="py-2.5 px-3 font-mono text-indigo-400">{d.downloadType}</td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                                  {(d.fileSizeBytes / 1024).toFixed(1)} KB
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                                  {new Date(d.createdAt).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => setSelectedProjectId(d.projectId)}
                                    className="text-indigo-400 hover:underline"
                                  >
                                    Project #{d.projectId}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SECTION: ACCOUNT SETTINGS */}
                  {activeSection === 'settings' && (
                    <div className="space-y-6">
                      {/* GitHub OAuth Connection Card */}
                      <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-indigo-400" />
                            <h2 className="text-sm font-bold text-white">GitHub Integration & Repository Sync</h2>
                            {currentUser?.githubConnected ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300">
                                CONNECTED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                                NOT CONNECTED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            {currentUser?.githubConnected
                              ? `Authenticated as @${currentUser.githubUsername} (Scopes: ${currentUser.githubScopes || 'read:user, user:email, repo'}). Access token is AES-256-GCM encrypted at rest.`
                              : 'Connect your GitHub account to enable 1-click repository creation and direct code commits from SiteForge AI.'}
                          </p>
                          <div className="text-[11px] font-mono text-slate-500">
                            OAuth Callback URL: {window.location.origin}/auth/github/callback
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {currentUser?.githubConnected ? (
                            <>
                              <button
                                onClick={handleConnectGithub}
                                className="px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-semibold text-white"
                              >
                                Reconnect GitHub
                              </button>
                              <button
                                onClick={handleDisconnectGithub}
                                className="px-3.5 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-950/40 text-xs font-semibold"
                              >
                                Disconnect
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={handleConnectGithub}
                              className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-sm"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              <span>Connect GitHub Account</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
                        <h2 className="text-sm font-bold text-white">Change Account Password</h2>
                        <form onSubmit={handleChangePassword} className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Current Password</label>
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">New Password (min 8 chars)</label>
                            <input
                              type="password"
                              required
                              minLength={8}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-xs text-white"
                            />
                          </div>
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                          >
                            Update Password
                          </button>
                        </form>
                      </div>

                      <div className="p-5 rounded-xl border border-red-900/40 bg-[#0D1320] space-y-4">
                        <h2 className="text-sm font-bold text-red-400">Danger Zone — Delete Account</h2>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Permanently delete your user account, projects, crawl history, and generated files from PostgreSQL.
                        </p>
                        {!confirmDeleteOpen ? (
                          <button
                            onClick={() => setConfirmDeleteOpen(true)}
                            className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-950/40 text-xs font-semibold"
                          >
                            Delete Account...
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleDeleteAccount}
                              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
                            >
                              Confirm Permanent Deletion
                            </button>
                            <button
                              onClick={() => setConfirmDeleteOpen(false)}
                              className="px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION: BILLING */}
                  {activeSection === 'billing' && (
                    <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-6">
                      <div>
                        <h1 className="text-lg font-bold text-white">Subscription & Usage Quotas</h1>
                        <p className="text-xs text-slate-400">
                          Active Plan: <strong className="text-indigo-400">{currentUser?.plan || 'Pro'}</strong> · Limits scale immediately without artificial daily caps.
                        </p>
                      </div>

                      {subscription && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-slate-400">Monthly Crawl Page Quota</div>
                            <div className="text-lg font-bold text-white mt-1 tabular-nums">
                              {subscription.crawlPagesLimit.toLocaleString()} pages
                            </div>
                          </div>
                          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-slate-400">Artifact Storage Allocation</div>
                            <div className="text-lg font-bold text-white mt-1 tabular-nums">
                              {(subscription.storageLimitBytes / (1024 * 1024)).toFixed(0)} MB
                            </div>
                          </div>
                          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-slate-400">AI Reconstructions</div>
                            <div className="text-lg font-bold text-white mt-1 tabular-nums">
                              {subscription.aiGenerationsLimit.toLocaleString()} runs / mo
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {(['Free', 'Pro', 'Business', 'Enterprise'] as const).map((tier) => (
                          <div key={tier} className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between gap-4">
                            <div>
                              <div className="text-sm font-bold text-white">{tier}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {tier === 'Free' && '500 pages · 50 AI runs'}
                                {tier === 'Pro' && '10,000 pages · 1,000 AI runs'}
                                {tier === 'Business' && '50,000 pages · 5,000 AI runs'}
                                {tier === 'Enterprise' && '500,000 pages · 50,000 AI runs'}
                              </div>
                            </div>
                            <button
                              onClick={() => handleChangePlan(tier)}
                              disabled={currentUser?.plan === tier}
                              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold text-white"
                            >
                              {currentUser?.plan === tier ? 'Current Plan' : `Switch to ${tier}`}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION: HELP & DOCS */}
                  {activeSection === 'help' && (
                    <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
                      <h1 className="text-lg font-bold text-white">Platform Documentation & REST API Guide</h1>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        SiteForge AI provides a complete end-to-end pipeline for authorized website crawling, structural analysis, and AI-assisted full-stack reconstruction.
                      </p>
                      <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
{`POST /api/projects
POST /api/projects/:id/analyze
POST /api/projects/:id/recreate
GET  /api/projects/:id
GET  /api/projects/:id/files
GET  /api/projects/:id/download?type=FULL_ZIP
POST /api/jobs/:id/cancel
POST /api/jobs/:id/retry`}
                      </pre>
                    </div>
                  )}

                </>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}


class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected application error.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('SiteForge AI render error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0D1320] p-6 shadow-2xl">
          <div className="text-lg font-bold">SiteForge AI could not display the workspace</div>
          <p className="mt-2 text-sm text-slate-400">Your authentication may have succeeded, but the interface hit an unexpected rendering error. Reload the workspace and try again.</p>
          <div className="mt-4 rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-rose-300 break-words">{this.state.message}</div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-indigo-500"
          >
            Reload SiteForge AI
          </button>
        </div>
      </div>
    );
  }
}

export default function AppWithErrorBoundary() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
