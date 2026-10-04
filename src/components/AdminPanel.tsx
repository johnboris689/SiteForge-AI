import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  FolderGit2,
  Activity,
  Terminal,
  Settings,
  Search,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface AdminPanelProps {
  authToken: string;
  currentUserId: number;
  onSelectProject: (projectId: number) => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function AdminPanel({
  authToken,
  currentUserId,
  onSelectProject,
  onNotify,
}: AdminPanelProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'projects' | 'jobs' | 'logs' | 'settings'>('users');
  const [userSearch, setUserSearch] = useState('');
  const [settingKey, setSettingKey] = useState('MAX_CONCURRENT_CRAWLERS');
  const [settingValue, setSettingValue] = useState('10');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load admin console.');
      setData(json);
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [authToken]);

  const handleUpdateUser = async (userId: number, patch: { status?: string; role?: string; plan?: string }) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onNotify(`Updated user #${userId}`, 'success');
      fetchAdminData();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onNotify(`Deleted user #${userId}`, 'info');
      fetchAdminData();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ key: settingKey, value: settingValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onNotify(`Saved setting ${settingKey}`, 'success');
      fetchAdminData();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  if (loading || !data) {
    return (
      <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] text-xs text-slate-400">
        Loading Administrator Console...
      </div>
    );
  }

  const filteredUsers = (data.users || []).filter(
    (u: any) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-white">Platform Administration & Security Console</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-based administration of users, crawl jobs, AI reconstructions, audit logs, and system parameters.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Real Admin Metric Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          ['Total Registered Users', data.users.length],
          ['Total Projects', data.projects.length],
          ['Crawl Jobs Logged', data.crawlJobs.length],
          ['AI Generations', data.aiJobs.length],
          ['Security Audit Events', data.auditLogs.length],
        ].map(([label, count]) => (
          <div key={String(label)} className="p-4 rounded-xl border border-slate-800 bg-[#0D1320]">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">{count}</div>
          </div>
        ))}
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-800 bg-[#0D1320] overflow-x-auto">
        {(
          [
            ['users', `Users (${data.users.length})`, Users],
            ['projects', `All Projects (${data.projects.length})`, FolderGit2],
            ['jobs', `Crawl & AI Jobs (${data.crawlJobs.length + data.aiJobs.length})`, Activity],
            ['logs', `Security & Audit Logs (${data.auditLogs.length})`, Terminal],
            ['settings', 'System Settings', Settings],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveSubTab(id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeSubTab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* USERS MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white">User Account & Role Management</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by email or name..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Name & Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 font-mono text-slate-400">#{u.id}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">{u.name}</div>
                      <div className="font-mono text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                        className="px-2 py-1 rounded border border-slate-700 bg-slate-950 text-xs font-mono text-white"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-300">{u.plan}</td>
                    <td className="py-2.5 px-3 font-mono">
                      <span className={u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.status === 'active' ? (
                          <button
                            onClick={() => handleUpdateUser(u.id, { status: 'suspended' })}
                            disabled={u.id === currentUserId}
                            className="px-2.5 py-1 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateUser(u.id, { status: 'active' })}
                            className="px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.id === currentUserId}
                          className="p-1.5 rounded border border-red-900/50 text-red-400 hover:bg-red-950/50 disabled:opacity-40"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ALL PROJECTS */}
      {activeSubTab === 'projects' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320]">
          <h2 className="text-sm font-bold text-white mb-4">All Platform Projects</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Project Name</th>
                  <th className="py-2.5 px-3">URL</th>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Pages / Assets</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.projects.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-3 font-mono text-slate-400">#{p.id}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-300">{p.originalUrl}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">User #{p.userId}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300">
                      {p.pagesDiscovered}p / {p.assetsDiscovered}a
                    </td>
                    <td className="py-2.5 px-3 font-mono uppercase text-emerald-400">{p.status}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectProject(p.id)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Open Workspace →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRAWL & AI JOBS */}
      {activeSubTab === 'jobs' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white mb-3">Crawl Worker Queue History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Job ID</th>
                    <th className="py-2 px-3">Project</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Pages / Assets</th>
                    <th className="py-2 px-3">Step / Error</th>
                    <th className="py-2 px-3 text-right">Started At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.crawlJobs.map((j: any) => (
                    <tr key={j.id}>
                      <td className="py-2 px-3 font-mono text-slate-400">#{j.id}</td>
                      <td className="py-2 px-3 font-mono text-white">Project #{j.projectId}</td>
                      <td className="py-2 px-3 font-mono uppercase text-indigo-400">{j.status}</td>
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-300">
                        {j.pagesProcessed}/{j.pagesTotal}p · {j.assetsProcessed}/{j.assetsTotal}a
                      </td>
                      <td className="py-2 px-3 text-slate-300">{j.errorMessage || j.currentStep}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {new Date(j.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY & AUDIT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320]">
          <h2 className="text-sm font-bold text-white mb-3">Structured Audit & Security Events</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">User / Project</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Duration</th>
                  <th className="py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.auditLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-900/50">
                    <td className="py-2 px-3 text-slate-400 tabular-nums">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-white font-semibold">{log.action}</td>
                    <td className="py-2 px-3 text-slate-400">
                      U:{log.userId || '-'} / P:{log.projectId || '-'}
                    </td>
                    <td className="py-2 px-3">
                      <span className={log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-400">{log.durationMs}ms</td>
                    <td className="py-2 px-3 text-slate-300 max-w-md truncate">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SYSTEM SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-5">
          <h2 className="text-sm font-bold text-white">Global Platform Configuration</h2>
          <form onSubmit={handleSaveSetting} className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <input
              type="text"
              value={settingKey}
              onChange={(e) => setSettingKey(e.target.value)}
              placeholder="SETTING_KEY"
              className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono text-white"
            />
            <input
              type="text"
              value={settingValue}
              onChange={(e) => setSettingValue(e.target.value)}
              placeholder="Value"
              className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              Save System Parameter
            </button>
          </form>

          <div className="divide-y divide-slate-800 text-xs font-mono max-w-2xl">
            {(data.systemSettings || []).map((s: any) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between">
                <span className="text-indigo-300">{s.key}</span>
                <span className="text-white">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
