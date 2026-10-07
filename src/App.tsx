import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import { AuthModal } from './components/AuthModal.tsx';
import { ProjectWorkspace } from './components/ProjectWorkspace.tsx';
import { Code2, GitBranch, LogOut, Menu, X, Plus, Globe2, CheckCircle2, Clock3, AlertCircle } from 'lucide-react';

type Workspace = 'creation' | 'publish';

export default function App() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('siteforge_auth_token'));
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>('creation');
  const [authOpen, setAuthOpen] = useState(!token);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [mobileNav, setMobileNav] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (t: string) => {
    const me = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } });
    if (!me.ok) throw new Error('Session expired. Please sign in again.');
    const md = await me.json();
    setUser(md.user);
    const p = await fetch('/api/projects', { headers: { Authorization: `Bearer ${t}` } });
    if (p.ok) {
      const pd = await p.json();
      setProjects(Array.isArray(pd.projects) ? pd.projects : Array.isArray(pd) ? pd : []);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ghToken = params.get('github_token');
    if (ghToken) {
      history.replaceState({}, document.title, location.pathname);
      sessionStorage.setItem('siteforge_auth_token', ghToken);
      setToken(ghToken);
      setAuthOpen(false);
      load(ghToken).catch(e => setError(e.message));
    }
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (!fbUser || token || ghToken) return;
      const t = await fbUser.getIdToken();
      sessionStorage.setItem('siteforge_auth_token', t);
      setToken(t); setAuthOpen(false);
      load(t).catch(e => setError(e.message));
    });
    return () => unsub();
  }, []);

  const onAuth = async (t: string, u?: any) => {
    sessionStorage.setItem('siteforge_auth_token', t);
    setToken(t); setUser(u || null); setAuthOpen(false); setError(null);
    try { await load(t); } catch (e: any) { setError(e.message); }
  };

  const logout = async () => {
    if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    await signOut(auth).catch(() => {});
    sessionStorage.removeItem('siteforge_auth_token');
    setToken(null); setUser(null); setProjects([]); setSelectedProjectId(null); setAuthOpen(true);
  };

  if (!token) {
    return <div className="min-h-screen bg-[#070708] text-white flex items-center justify-center"><AuthModal isOpen={authOpen} initialMode={authMode} onClose={() => setAuthOpen(true)} onSuccess={onAuth} /></div>;
  }

  const selected = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#070708] text-zinc-100 flex flex-col">
      <header className="h-14 shrink-0 border-b border-white/10 bg-[#0a0a0c]/95 backdrop-blur flex items-center justify-between px-3 sm:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <button className="lg:hidden p-2 rounded-lg border border-white/10" onClick={() => setMobileNav(v => !v)}>{mobileNav ? <X size={17}/> : <Menu size={17}/>}</button>
          <div className="w-8 h-8 rounded-lg bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">SF</div>
          <div className="min-w-0"><div className="font-semibold tracking-tight">Site Forge <span className="text-red-500">AI</span></div><div className="hidden sm:block text-[9px] uppercase tracking-[.24em] text-zinc-600">AI website recreation studio</div></div>
        </div>
        <nav className="hidden md:flex items-center rounded-lg border border-white/10 bg-white/[.02] p-1">
          <button onClick={() => setWorkspace('creation')} className={`px-4 py-1.5 rounded-md text-xs font-semibold ${workspace === 'creation' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}><Code2 size={14} className="inline mr-1.5"/>AI Creation</button>
          <button onClick={() => setWorkspace('publish')} className={`px-4 py-1.5 rounded-md text-xs font-semibold ${workspace === 'publish' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}><GitBranch size={14} className="inline mr-1.5"/>GitHub Publish</button>
        </nav>
        <div className="flex items-center gap-2"><span className="hidden sm:block text-xs text-zinc-400 truncate max-w-44">{user?.name || user?.email}</span><button onClick={logout} className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white" title="Log out"><LogOut size={15}/></button></div>
      </header>
      {mobileNav && <div className="absolute z-40 top-14 left-0 right-0 bg-[#0b0b0d] border-b border-white/10 p-2 md:hidden"><button className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-sm" onClick={() => {setWorkspace('creation');setMobileNav(false)}}>AI Creation</button><button className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-sm" onClick={() => {setWorkspace('publish');setMobileNav(false)}}>GitHub Publish</button></div>}
      {error && <div className="absolute z-50 top-16 right-4 max-w-sm p-3 rounded-xl bg-red-950/95 border border-red-500/30 text-xs text-red-100"><AlertCircle size={14} className="inline mr-2"/>{error}<button className="ml-3 underline" onClick={() => setError(null)}>dismiss</button></div>}

      <main className="flex-1 min-h-0 overflow-hidden">
        {workspace === 'creation' && selectedProjectId ? (
          <ProjectWorkspace projectId={selectedProjectId} authToken={token} currentUser={user} onConnectGithub={() => setWorkspace('publish')} onBack={() => setSelectedProjectId(null)} onProjectDeleted={() => {setSelectedProjectId(null); load(token)}} onProjectDuplicated={id => {setSelectedProjectId(id); load(token)}} onNotify={(m,t) => t === 'error' ? setError(m) : undefined}/>
        ) : workspace === 'creation' ? (
          <CreationHome projects={projects} onOpen={id => setSelectedProjectId(id)} onRefresh={() => load(token)} />
        ) : (
          <PublishHome projects={projects} selected={selected} onOpen={id => {setSelectedProjectId(id);setWorkspace('creation')}} onConnect={() => {setWorkspace('creation'); setSelectedProjectId(selected?.id || null)}} />
        )}
      </main>
    </div>
  );
}

function CreationHome({ projects, onOpen, onRefresh }: { projects: any[]; onOpen: (id:number)=>void; onRefresh:()=>void }) {
  const [url, setUrl] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const token = sessionStorage.getItem('siteforge_auth_token');
  const start = async (e: React.FormEvent) => {
    e.preventDefault(); if (!authorized || !token || working) return;
    setWorking(true); setMessage('Validating URL and starting the real crawl…');
    try {
      const res = await fetch('/api/projects', {method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({url:url.trim(), name:'', mode:'RECREATE', scope:'SAME_DOMAIN', extractionMode:'AI_RECONSTRUCTION', acceptedAcceptableUse:true, config:{scope:'SAME_DOMAIN',extractionMode:'AI_RECONSTRUCTION',maxPages:50,maxDepth:8,maxFileSizeKb:10240,requestDelayMs:150,sameDomainOnly:true,includeSubdomains:false,followExternalAssets:true,respectRobotsTxt:true,stopOnError:false,retryFailed:true,assets:{html:true,css:true,js:true,images:true,svg:true,fonts:true,json:true,metadata:true}}})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'Unable to start analysis.');
      setMessage('Crawl started. Opening the live project workspace…'); onRefresh(); onOpen(data.project.id);
    } catch(e:any){setMessage(e.message||'Analysis failed.');} finally{setWorking(false);}
  };
  return <div className="h-full overflow-auto"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 lg:py-10">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><div className="text-[10px] uppercase tracking-[.28em] text-red-500 font-semibold">AI CREATION</div><h1 className="mt-2 text-3xl lg:text-5xl font-semibold tracking-tight">Recreate an authorized website as a real project.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Crawl public evidence, capture pages and assets, analyze structure and design, generate source files, preview the result, and keep modifying it with AI.</p></div><div className="text-[11px] text-zinc-600">Public resources only · no credentials or sessions</div></div>
    <form onSubmit={start} className="mt-7 grid lg:grid-cols-[1fr_330px] gap-4"><section className="rounded-2xl border border-white/10 bg-white/[.025] p-5 lg:p-7"><label className="text-xs font-semibold text-zinc-300">Authorized website URL</label><div className="mt-2 flex gap-2"><Globe2 className="w-5 h-5 mt-3 ml-2 text-zinc-600"/><input required type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" className="flex-1 h-12 bg-[#08080a] border border-white/10 rounded-xl px-3 text-sm outline-none focus:border-red-500/60"/></div><label className="mt-5 flex gap-3 items-start text-xs text-zinc-400 leading-5"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)} className="mt-1 accent-red-600"/><span><b className="block text-zinc-100">I own this website or have authorization to analyze/recreate it.</b> Site Forge does not capture passwords, cookies, MFA codes, private credentials, or private network resources.</span></label><button disabled={!authorized||working} className="mt-6 h-11 px-5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-semibold">{working?'Starting…':'Analyze & Forge'}</button>{message&&<div className="mt-4 text-xs text-zinc-400">{message}</div>}</section><aside className="rounded-2xl border border-white/10 bg-[#0b0b0e] p-5"><div className="text-xs font-semibold">Real pipeline</div>{['Validate URL','Crawl pages','Discover assets','Analyze structure/design','Generate source','Build preview','Review & approve','Publish to GitHub'].map((s,i)=><div key={s} className="mt-3 flex items-center gap-3 text-xs text-zinc-500"><span className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-[9px]">{i+1}</span>{s}</div>)}</aside></form>
    <div className="mt-9"><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold">Projects</h2><span className="text-[11px] text-zinc-600">{projects.length} saved</span></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{projects.map(p=><button key={p.id} onClick={()=>onOpen(p.id)} className="text-left rounded-xl border border-white/10 bg-white/[.02] hover:bg-white/[.04] p-4"><div className="flex justify-between gap-3"><span className="text-sm font-medium truncate">{p.name}</span><Status status={p.status}/></div><div className="mt-2 text-[11px] text-zinc-600 truncate">{p.originalUrl}</div><div className="mt-3 text-[10px] text-zinc-600">{p.pagesDiscovered||0} pages · {p.assetsDiscovered||0} assets</div></button>)}{!projects.length&&<div className="md:col-span-3 p-10 border border-dashed border-white/10 rounded-xl text-center text-xs text-zinc-600">Start by entering an authorized public website URL above.</div>}</div></div>
  </div></div>;
}

function PublishHome({projects, selected, onOpen, onConnect}:{projects:any[];selected:any;onOpen:(id:number)=>void;onConnect:()=>void}){
 return <div className="h-full overflow-auto"><div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><div className="text-[10px] uppercase tracking-[.28em] text-red-500 font-semibold">GITHUB PUBLISH</div><h1 className="mt-2 text-3xl font-semibold">Review, approve, and publish real source.</h1><p className="mt-2 max-w-2xl text-sm text-zinc-400">GitHub operations are performed through the authenticated GitHub API. No repository URLs or success states are fabricated.</p><div className="mt-7 grid gap-3">{projects.map(p=><div key={p.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><div className="font-semibold">{p.name}</div><div className="mt-1 text-xs text-zinc-500 truncate max-w-xl">{p.originalUrl}</div><div className="mt-2 flex gap-3 text-[10px] text-zinc-600"><Status status={p.status}/><span>{p.pagesDiscovered||0} pages</span><span>{p.assetsDiscovered||0} assets</span></div></div><div className="flex gap-2"><button onClick={()=>onOpen(p.id)} className="px-4 py-2 rounded-lg border border-white/10 text-xs">Review project</button>{p.githubRepositoryUrl&&<a href={p.githubRepositoryUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg bg-red-600 text-xs font-semibold">Open GitHub</a>}</div></div>)}{!projects.length&&<div className="p-12 text-center border border-dashed border-white/10 rounded-2xl text-xs text-zinc-600">No generated projects are ready to publish.</div>}</div>{selected&&<div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/[.02] text-xs text-zinc-400">Selected project: <b className="text-white">{selected.name}</b>. Open it to review files and use the server-side GitHub push flow.</div>}</div></div>;
}
function Status({status}:{status:string}){const running=['queued','validating','crawling','analyzing','reconstructing','packaging'].includes(status);return <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500">{running?<Clock3 size={10}/>:status==='completed'?<CheckCircle2 size={10} className="text-emerald-500"/>:null}{status}</span>}
