import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Player from '@vimeo/player';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, BarChart3, Check, Download,
  ExternalLink, Eye, FileSpreadsheet, Heart, LockKeyhole, LogOut, MessageCircle,
  Play, RefreshCw, School, ShieldCheck, Trash2, UserRound, Users, Video, X,
} from 'lucide-react';
import { env, isDemoMode } from './lib/config';
import { gateFunction, memberFunction, publicFunction, supabase } from './lib/supabase';

type Screen = 'welcome' | 'members' | 'video';
type Member = { code: string; name: string; emailAlias: string; role: 'admin' | 'member' };
type CommentItem = { id: string; content: string; created_at: string; expires_at?: string };
type DashboardData = {
  profile: { id: string; display_name: string; role: 'admin' | 'member' };
  members: { id: string; member_code: string; display_name: string; role: 'admin' | 'member' }[];
  settings: { active_vimeo_id: string; active_vimeo_hash: string; active_mp4_url: string; announcement: string; exhibition_info: string };
  comments: CommentItem[];
  analytics: { visits: number; uniqueVisitors: number; plays: number; uniqueViewers: number; likes: number; comments: number; liveVisitorsEstimate: number };
  daily: { date: string; visits: number; plays: number }[];
  events: { event_type: string; created_at: string }[];
};

const MEMBERS: Member[] = [
  { code: '01', name: 'Aman Alam', emailAlias: 'aman@physicsdigitalhub.test', role: 'admin' },
  { code: '02', name: 'Abhirup Baru', emailAlias: 'abhirup@physicsdigitalhub.test', role: 'member' },
  { code: '03', name: 'Sandipan Mukherjee', emailAlias: 'sandipan@physicsdigitalhub.test', role: 'member' },
  { code: '04', name: 'Khushi Rawani', emailAlias: 'khushi@physicsdigitalhub.test', role: 'member' },
  { code: '05', name: 'Neha Kumari', emailAlias: 'neha@physicsdigitalhub.test', role: 'member' },
  { code: '06', name: 'Ananya Gope', emailAlias: 'ananya@physicsdigitalhub.test', role: 'member' },
];

const DEMO_COMMENTS_KEY = 'pdh-demo-comments';
const DEMO_LIKE_KEY = 'pdh-demo-liked';
const BROWSER_ID_KEY = 'pdh-browser-id';

function safeStorageGet(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}
function safeStorageSet(storage: Storage, key: string, value: string): void {
  try { storage.setItem(key, value); } catch { /* Storage may be disabled by browser privacy settings. */ }
}
function safeStorageRemove(storage: Storage, key: string): void {
  try { storage.removeItem(key); } catch { /* Storage may be disabled by browser privacy settings. */ }
}
function createBrowserId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function getBrowserId(): string {
  try {
    const saved = localStorage.getItem(BROWSER_ID_KEY);
    if (saved) return saved;
    const id = createBrowserId();
    localStorage.setItem(BROWSER_ID_KEY, id);
    return id;
  } catch {
    return createBrowserId();
  }
}

type EmergencyVideoConfig = { vimeoId: string; vimeoHash: string; vimeoUrl: string; mp4DownloadUrl: string };

async function readEmergencyVideoConfig(): Promise<EmergencyVideoConfig> {
  const empty: EmergencyVideoConfig = { vimeoId: '', vimeoHash: '', vimeoUrl: '', mp4DownloadUrl: '' };
  try {
    const response = await fetch('/emergency-links.json', { cache: 'no-store' });
    if (!response.ok) return empty;
    const data = await response.json() as Record<string, unknown>;
    const vimeoUrl = typeof data.vimeoUrl === 'string' && /^https:\/\//i.test(data.vimeoUrl) ? data.vimeoUrl : '';
    const mp4DownloadUrl = typeof data.mp4DownloadUrl === 'string' && /^https:\/\//i.test(data.mp4DownloadUrl) ? data.mp4DownloadUrl : '';
    let vimeoId = typeof data.vimeoId === 'string' && /^\d{5,20}$/.test(data.vimeoId) ? data.vimeoId : '';
    let vimeoHash = typeof data.vimeoHash === 'string' && /^[a-zA-Z0-9]{4,64}$/.test(data.vimeoHash) ? data.vimeoHash : '';
    if (vimeoUrl) {
      const parsed = new URL(vimeoUrl);
      if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(parsed.hostname.toLowerCase())) {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const idIndex = pathParts.findIndex((part) => /^\d{5,20}$/.test(part));
        if (!vimeoId && idIndex >= 0) vimeoId = pathParts[idIndex];
        if (!vimeoHash) {
          const pathHash = idIndex >= 0 ? pathParts[idIndex + 1] ?? '' : '';
          const queryHash = parsed.searchParams.get('h') ?? '';
          vimeoHash = /^[a-zA-Z0-9]{4,64}$/.test(queryHash) ? queryHash
            : /^[a-zA-Z0-9]{4,64}$/.test(pathHash) ? pathHash : '';
        }
      }
    }
    return { vimeoId, vimeoHash, vimeoUrl, mp4DownloadUrl };
  } catch {
    return empty;
  }
}

function readDemoComments(): CommentItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_COMMENTS_KEY) ?? '[]') as CommentItem[];
    const now = Date.now();
    return parsed.filter((item) => new Date(item.expires_at ?? item.created_at).getTime() > now);
  } catch {
    return [];
  }
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function CraneBlueprint() {
  return (
    <svg className="crane-blueprint" viewBox="0 0 640 390" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="beam" x1="120" y1="40" x2="520" y2="330" gradientUnits="userSpaceOnUse">
          <stop stopColor="#75f5ff" /><stop offset="1" stopColor="#1887ff" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g stroke="#3aaeff" strokeOpacity=".2" strokeWidth="1">
        {Array.from({ length: 12 }, (_, i) => <path key={`v${i}`} d={`M${40 + i * 50} 18V370`} />)}
        {Array.from({ length: 8 }, (_, i) => <path key={`h${i}`} d={`M20 ${35 + i * 45}H620`} />)}
      </g>
      <g stroke="url(#beam)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)">
        <path d="M115 330H518M164 330L215 91H249L300 330M215 91L300 330M249 91L164 330" />
        <path d="M216 91H500L549 116H216M248 91L285 65H486" />
        <path d="M285 65L316 91M486 65L500 91M285 65H486" />
        <path d="M447 91V198M439 198H455M447 198L468 226" />
        <path d="M468 226V258M458 258H478L468 276Z" />
        <path d="M198 135L268 135M185 190L278 190M174 245L289 245" strokeOpacity=".75" />
        <path d="M365 91V330M365 142H414M365 197H414M365 252H414" strokeOpacity=".4" />
      </g>
      <g fill="#8cf8ff" filter="url(#glow)"><circle cx="215" cy="91" r="5"/><circle cx="486" cy="65" r="5"/><circle cx="447" cy="198" r="4"/></g>
      <g stroke="#8cf8ff" strokeOpacity=".45"><path d="M95 344H545" strokeDasharray="6 7"/><circle cx="320" cy="198" r="174" strokeDasharray="2 12"/></g>
    </svg>
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [memberPortalOpen, setMemberPortalOpen] = useState(false);
  const [view, setView] = useState<'public' | 'dashboard'>('public');
  const [memberStage, setMemberStage] = useState<'access' | 'shared' | 'choose' | 'individual'>('access');
  const [sharedPassword, setSharedPassword] = useState('');
  const [individualPassword, setIndividualPassword] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [gateToken, setGateToken] = useState(safeStorageGet(sessionStorage, 'pdh-gate-token') ?? '');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [vimeoId, setVimeoId] = useState(env.initialVimeoId);
  const [vimeoHash, setVimeoHash] = useState(env.initialVimeoHash);
  const [videoError, setVideoError] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(env.initialDownloadUrl);
  const [comments, setComments] = useState<CommentItem[]>(isDemoMode ? readDemoComments() : []);
  const [commentText, setCommentText] = useState('');
  const [commentsError, setCommentsError] = useState('');
  const [liked, setLiked] = useState(safeStorageGet(localStorage, DEMO_LIKE_KEY) === 'true');
  const [likeCount, setLikeCount] = useState(0);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [settingsDraft, setSettingsDraft] = useState({ active_vimeo_id: '', active_vimeo_hash: '', active_mp4_url: '', announcement: '', exhibition_info: '' });
  const [profileTab, setProfileTab] = useState<'overview' | 'comments' | 'video' | 'analytics' | 'members'>('overview');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pageVisitTrackedRef = useRef(false);
  const [reloadCommentsTick, setReloadCommentsTick] = useState(0);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3600);
  }, []);

  // Four-second welcome and five-second members intro. Timers also act as animation fail-safes.
  useEffect(() => {
    if (view !== 'public') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = screen === 'welcome' ? (reduceMotion ? 1200 : 4000) : screen === 'members' ? (reduceMotion ? 1400 : 5000) : 0;
    if (!delay) return;
    const timer = window.setTimeout(() => setScreen(screen === 'welcome' ? 'members' : 'video'), delay);
    return () => window.clearTimeout(timer);
  }, [screen, view]);

  useEffect(() => {
    if (view !== 'public' || screen !== 'video') return;
    let cancelled = false;
    const load = async () => {
      // This same-origin static file is independent of Supabase. It supplies a video
      // fallback for first-time visitors when the database or Edge Functions are down.
      const fallback = await readEmergencyVideoConfig();
      if (cancelled) return;
      if (fallback.vimeoId) setVimeoId(fallback.vimeoId);
      if (fallback.vimeoHash) setVimeoHash(fallback.vimeoHash);
      if (fallback.mp4DownloadUrl) setDownloadUrl(fallback.mp4DownloadUrl);
      if (isDemoMode) {
        setComments(readDemoComments());
        setLiked(safeStorageGet(localStorage, DEMO_LIKE_KEY) === 'true');
        return;
      }
      try {
        const result = await publicFunction<{
          vimeo_id?: string; vimeo_hash?: string; mp4_url?: string; likes?: number; has_liked?: boolean; comments?: CommentItem[];
        }>({ action: 'config', browser_id: getBrowserId() });
        if (cancelled) return;
        if (result.vimeo_id) {
          setVimeoId(result.vimeo_id);
          setVimeoHash(result.vimeo_hash ?? '');
        }
        if (result.mp4_url) setDownloadUrl(result.mp4_url);
        setLikeCount(result.likes ?? 0);
        setLiked(Boolean(result.has_liked));
        setComments(result.comments ?? []);
      } catch {
        if (!cancelled) setCommentsError('Community features are temporarily unavailable. The video can still be watched.');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [screen, view, reloadCommentsTick]);

  useEffect(() => {
    if (view !== 'public' || screen !== 'welcome' || isDemoMode || pageVisitTrackedRef.current) return;
    pageVisitTrackedRef.current = true;
    void publicFunction({ action: 'track', event_type: 'page_visit', browser_id: getBrowserId(), page: 'welcome' }).catch(() => undefined);
  }, [screen, view]);

  useEffect(() => {
    if (view !== 'public' || screen !== 'video' || isDemoMode) return;
    const browserId = getBrowserId();
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void publicFunction({ action: 'track', event_type: 'page_heartbeat', browser_id: browserId, page: 'video' }).catch(() => undefined);
      }
    }, 120_000);
    return () => window.clearInterval(heartbeat);
  }, [screen, view]);

  useEffect(() => { setVideoError(false); }, [vimeoId]);

  useEffect(() => {
    if (!vimeoId || screen !== 'video' || view !== 'public' || !iframeRef.current) return;
    const player = new Player(iframeRef.current);
    const onPlay = () => {
      if (!isDemoMode) void publicFunction({ action: 'track', event_type: 'video_play', browser_id: getBrowserId(), page: 'video' }).catch(() => undefined);
    };
    const onPlayerError = () => setVideoError(true);
    player.on('play', onPlay);
    player.on('error', onPlayerError);
    let ready = false;
    const watchdog = window.setTimeout(() => { if (!ready) onPlayerError(); }, 12_000);
    player.ready().then(() => { ready = true; window.clearTimeout(watchdog); }).catch(() => { ready = true; window.clearTimeout(watchdog); onPlayerError(); });
    return () => { window.clearTimeout(watchdog); player.off('play', onPlay); player.off('error', onPlayerError); player.destroy().catch(() => undefined); };
  }, [vimeoId, screen, view]);

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    const content = commentText.trim();
    if (content.length < 2 || content.length > 500) {
      showToast('Comments must contain 2–500 characters.');
      return;
    }
    setBusy(true);
    setCommentsError('');
    try {
      if (isDemoMode) {
        const now = new Date().toISOString();
        const next = [{ id: crypto.randomUUID(), content, created_at: now, expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() }, ...readDemoComments()];
        safeStorageSet(localStorage, DEMO_COMMENTS_KEY, JSON.stringify(next));
        setComments(next);
      } else {
        const result = await publicFunction<{ comment: CommentItem }>({ action: 'comment_add', browser_id: getBrowserId(), content });
        if (result.comment) setComments((current) => [result.comment, ...current].slice(0, 50));
      }
      setCommentText('');
      showToast('Comment published.');
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : 'Comment could not be published. Please retry.');
    } finally { setBusy(false); }
  };

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isDemoMode) {
        const next = !liked;
        setLiked(next);
        safeStorageSet(localStorage, DEMO_LIKE_KEY, String(next));
        setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
      } else {
        const result = await publicFunction<{ liked: boolean; total_likes: number }>({ action: 'like_toggle', browser_id: getBrowserId() });
        setLiked(result.liked);
        setLikeCount(result.total_likes);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Like could not be updated. Please retry.');
    } finally { setBusy(false); }
  };

  const verifySharedPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!sharedPassword.trim()) return;
    setBusy(true);
    try {
      if (isDemoMode) throw new Error('Member login activates after the Supabase setup is completed.');
      const result = await gateFunction<{ gate_token: string }>({ password: sharedPassword });
      setGateToken(result.gate_token);
      safeStorageSet(sessionStorage, 'pdh-gate-token', result.gate_token);
      setMemberStage('choose');
      setSharedPassword('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Shared password was not accepted.');
    } finally { setBusy(false); }
  };

  const signInMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMember || !supabase || !gateToken) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: selectedMember.emailAlias, password: individualPassword });
      if (error) throw new Error('That individual password was not accepted.');
      const data = await memberFunction<DashboardData>({ action: 'dashboard', days: analyticsDays }, gateToken);
      setDashboard(data);
      setSettingsDraft(data.settings);
      setIndividualPassword('');
      setMemberPortalOpen(false);
      setView('dashboard');
      setProfileTab('overview');
    } catch (error) {
      await supabase.auth.signOut().catch(() => undefined);
      showToast(error instanceof Error ? error.message : 'Member sign-in failed.');
    } finally { setBusy(false); }
  };

  const refreshDashboard = useCallback(async () => {
    if (!gateToken) return;
    setDashboardLoading(true);
    try {
      const data = await memberFunction<DashboardData>({ action: 'dashboard', days: analyticsDays }, gateToken);
      setDashboard(data);
      setSettingsDraft(data.settings);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Dashboard could not be refreshed.');
    } finally { setDashboardLoading(false); }
  }, [gateToken, analyticsDays, showToast]);

  useEffect(() => {
    if (view === 'dashboard') void refreshDashboard();
  }, [view, refreshDashboard]);

  // Keep the shared activity feed and live-visitor estimate fresh while a member
  // is actively viewing Overview or Analytics. This interval stays silent and
  // pauses automatically when the user switches to another tab or signs out.
  useEffect(() => {
    if (view !== 'dashboard' || !['overview', 'analytics'].includes(profileTab)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshDashboard();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [view, profileTab, refreshDashboard]);

  useEffect(() => {
    if (screen !== 'video' || view !== 'public') setCommentPanelOpen(false);
  }, [screen, view]);

  const deleteComment = async (id: string) => {
    if (!dashboard) return;
    try {
      await memberFunction({ action: 'delete_comment', comment_id: id }, gateToken);
      setDashboard({ ...dashboard, comments: dashboard.comments.filter((comment) => comment.id !== id) });
      showToast('Comment deleted.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Comment could not be deleted.'); }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await memberFunction({ action: 'update_settings', settings: settingsDraft }, gateToken);
      showToast('Website settings saved.');
      await refreshDashboard();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Settings could not be saved.'); }
  };

  const clearAnalytics = async () => {
    const confirmed = window.confirm('Clear all analytics event history? This cannot be undone. The public Like tally and active comments will remain unchanged.');
    if (!confirmed) return;
    try {
      await memberFunction({ action: 'clear_analytics' }, gateToken);
      showToast('Analytics cleared.');
      await refreshDashboard();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Analytics could not be cleared.'); }
  };

  const exportAnalytics = async () => {
    try {
      const result = await memberFunction<{ events: { event_type: string; page: string; created_at: string }[]; truncated: boolean }>({ action: 'export_analytics', days: analyticsDays }, gateToken);
      const rows = [['Date', 'Event', 'Page'], ...result.events.map((event) => [event.created_at, event.event_type, event.page])];
      const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `physics-digital-hub-analytics-${analyticsDays}days.csv`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (result.truncated) showToast('Export reached the 100,000-event safety limit. Please export a shorter date range.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Export could not be created.'); }
  };

  const downloadMemberDirectory = () => {
    if (!dashboard) return;
    const rows = [
      ['Member code', 'Member name', 'Role'],
      ...dashboard.members.map((member) => [member.member_code, member.display_name, member.role]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'physics-digital-hub-member-directory.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadProjectBackup = async () => {
    try {
      const backup = await memberFunction<Record<string, unknown>>({ action: 'project_backup' }, gateToken);
      const payload = JSON.stringify(backup, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `physics-digital-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Project backup downloaded.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Project backup could not be created.');
    }
  };

  const logout = async () => {
    await supabase?.auth.signOut();
    safeStorageRemove(sessionStorage, 'pdh-gate-token');
    setGateToken(''); setDashboard(null); setView('public'); setScreen('video');
    showToast('Signed out.');
  };

  const openMemberPortal = () => {
    setMemberStage('access'); setSelectedMember(null); setSharedPassword(''); setIndividualPassword('');
    setMemberPortalOpen(true);
  };

  const vimeoEmbedUrl = useMemo(() => {
    if (!vimeoId) return '';
    const params = new URLSearchParams({ dnt: '1', title: '0', byline: '0', portrait: '0', badge: '0' });
    if (vimeoHash) params.set('h', vimeoHash);
    return `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}?${params.toString()}`;
  }, [vimeoId, vimeoHash]);

  if (view === 'dashboard' && dashboard) {
    return (
      <div className="dashboard-shell">
        <header className="dash-topbar">
          <div className="dash-brand"><img src="/assets/sks-school-crest.webp" alt="S.K.S Public School crest" /><div><strong>PHYSICS DIGITAL HUB</strong><span>MEMBER CONTROL CENTRE</span></div></div>
          <div className="dash-user"><span className="role-pill"><ShieldCheck size={13}/>{dashboard.profile.role === 'admin' ? 'ADMINISTRATOR' : 'PROJECT MEMBER'}</span><span className="dash-user-name">{dashboard.profile.display_name}</span><button className="icon-button" onClick={logout} aria-label="Sign out"><LogOut size={18}/></button></div>
        </header>
        <main className="dashboard-main">
          <div className="dash-heading"><div><p className="eyebrow">PRIVATE PROJECT AREA</p><h1>Welcome, {dashboard.profile.display_name.split(' ')[0]}.</h1><p>Shared project workspace · S.K.S Public School</p></div><div className="dash-heading-actions">{dashboard.profile.role === 'admin' && <button className="secondary-button" onClick={() => void downloadProjectBackup()}><Download size={15}/> Backup</button>}<button className="secondary-button" onClick={() => void refreshDashboard()} disabled={dashboardLoading}><RefreshCw size={15} className={dashboardLoading ? 'spin' : ''}/> Refresh</button></div></div>
          <div className="dash-tabs">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'comments', label: 'Comments', icon: MessageCircle },
              { id: 'video', label: 'Video & updates', icon: Video },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'members', label: 'Members', icon: Users },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return <button key={tab.id} className={profileTab === tab.id ? 'dash-tab active' : 'dash-tab'} onClick={() => setProfileTab(tab.id as typeof profileTab)}><TabIcon size={16}/>{tab.label}</button>;
            })}
          </div>
          {profileTab === 'overview' && <>
            <div className="metric-grid">
              <Metric label="Page visits" value={dashboard.analytics.visits} icon={<Eye/>}/>
              <Metric label="Estimated visitors" value={dashboard.analytics.uniqueVisitors} icon={<Users/>}/>
              <Metric label="Video plays" value={dashboard.analytics.plays} icon={<Play/>}/>
              <Metric label="Likes" value={dashboard.analytics.likes} icon={<Heart/>}/>
            </div>
            <div className="dashboard-columns">
              <section className="panel-card"><div className="panel-title"><h2>Recent activity</h2><span>Latest events</span></div>{dashboard.events.slice(0, 7).length ? dashboard.events.slice(0, 7).map((event, index) => <div className="activity-row" key={`${event.created_at}-${index}`}><span className="activity-dot"/><div><strong>{event.event_type === 'page_visit' ? 'Project page visit' : event.event_type === 'video_play' ? 'Project video playback started' : 'Anonymous comment posted'}</strong><small>{formatTime(event.created_at)}</small></div></div>) : <EmptyState text="Analytics activity will appear here."/>}</section>
              <section className="panel-card"><div className="panel-title"><h2>Project team</h2><span>{dashboard.members.length} members</span></div>{dashboard.members.map((member) => <div className="team-row" key={member.id}><span className="avatar-mini">{member.display_name.slice(0,1)}</span><div><strong>{member.display_name}</strong><small>{member.role === 'admin' ? 'Administrator' : 'Project member'}</small></div>{member.role === 'admin' && <span className="tiny-tag">ADMIN</span>}</div>)}</section>
            </div>
            <p className="dash-footnote">All analytics are estimates based on privacy-friendly browser identifiers. They do not verify unique people.</p>
          </>}
          {profileTab === 'comments' && <section className="panel-card"><div className="panel-title"><div><h2>Community comments</h2><p>Anonymous comments expire after 72 hours. All six members can delete them.</p></div><span>{dashboard.comments.length} active</span></div>{dashboard.comments.length ? dashboard.comments.map((comment) => <div className="moderation-row" key={comment.id}><div><p>{comment.content}</p><small>Published {formatTime(comment.created_at)}</small></div><button className="danger-icon" aria-label="Delete comment" onClick={() => void deleteComment(comment.id)}><Trash2 size={16}/></button></div>) : <EmptyState text="There are no active comments right now."/>}</section>}
          {profileTab === 'video' && <div className="dashboard-columns"><section className="panel-card"><div className="panel-title"><h2>Active project video</h2><span>{dashboard.profile.role === 'admin' ? 'ADMIN CONTROL' : 'READ ONLY'}</span></div><form className="settings-form" onSubmit={saveSettings}><label>Vimeo video ID<input value={settingsDraft.active_vimeo_id} onChange={(e) => setSettingsDraft({ ...settingsDraft, active_vimeo_id: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Example: 123456789" disabled={dashboard.profile.role !== 'admin'}/></label><label>Vimeo privacy hash (only for unlisted videos)<input value={settingsDraft.active_vimeo_hash} onChange={(e) => setSettingsDraft({ ...settingsDraft, active_vimeo_hash: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })} placeholder="Leave blank for public videos" disabled={dashboard.profile.role !== 'admin'}/></label><label>MP4 download URL<input type="url" value={settingsDraft.active_mp4_url} onChange={(e) => setSettingsDraft({ ...settingsDraft, active_mp4_url: e.target.value })} placeholder="https://..." disabled={dashboard.profile.role !== 'admin'}/></label>{dashboard.profile.role === 'admin' ? <><button className="primary-button" type="submit">Save video details</button><p className="permission-note"><LockKeyhole size={14}/> After replacing the video, update <code>public/emergency-links.json</code> in GitHub with the same Vimeo ID and public MP4 URL, then redeploy. This keeps the video fallback available if Supabase is unavailable.</p></> : <p className="permission-note"><LockKeyhole size={14}/> Only Aman Alam can upload, replace, or publish the active video.</p>}</form></section><section className="panel-card"><div className="panel-title"><h2>Website announcements</h2><span>{dashboard.profile.role === 'admin' ? 'ADMIN CONTROL' : 'READ ONLY'}</span></div><form className="settings-form" onSubmit={saveSettings}><label>Announcement<textarea rows={3} value={settingsDraft.announcement} onChange={(e) => setSettingsDraft({ ...settingsDraft, announcement: e.target.value })} disabled={dashboard.profile.role !== 'admin'} placeholder="Internal project announcement"/></label><label>Exhibition information<textarea rows={3} value={settingsDraft.exhibition_info} onChange={(e) => setSettingsDraft({ ...settingsDraft, exhibition_info: e.target.value })} disabled={dashboard.profile.role !== 'admin'} placeholder="Internal exhibition notes"/></label>{dashboard.profile.role === 'admin' ? <button className="primary-button" type="submit">Save project updates</button> : <p className="permission-note"><LockKeyhole size={14}/> These management fields are administrator-controlled.</p>}</form></section></div>}
          {profileTab === 'analytics' && <section className="panel-card"><div className="panel-title"><div><h2>Project analytics</h2><p>Stored until the administrator manually clears them.</p></div><select value={analyticsDays} onChange={(e) => setAnalyticsDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div><div className="metric-grid compact"><Metric label="Visits" value={dashboard.analytics.visits} icon={<Eye/>}/><Metric label="Unique visitors*" value={dashboard.analytics.uniqueVisitors} icon={<Users/>}/><Metric label="Video plays" value={dashboard.analytics.plays} icon={<Play/>}/><Metric label="Unique viewers*" value={dashboard.analytics.uniqueViewers} icon={<Video/>}/><Metric label="Estimated active (5m)" value={dashboard.analytics.liveVisitorsEstimate} icon={<Activity/>}/><Metric label="Likes" value={dashboard.analytics.likes} icon={<Heart/>}/><Metric label="Comments" value={dashboard.analytics.comments} icon={<MessageCircle/>}/></div><AnalyticsChart data={dashboard.daily}/><div className="analytics-actions"><button className="secondary-button" onClick={() => void exportAnalytics()}><FileSpreadsheet size={16}/> Export CSV</button>{dashboard.profile.role === 'admin' && <button className="danger-button" onClick={() => void clearAnalytics()}><Trash2 size={15}/> Clear analytics history</button>}</div><p className="dash-footnote">*Unique visitor and viewer figures are estimates, not verified people. Browser storage changes or multiple devices may affect them.</p></section>}
          {profileTab === 'members' && <section className="panel-card"><div className="panel-title"><div><h2>Project member accounts</h2><p>Six individual accounts · one administrator · no password recovery</p></div><button className="secondary-button" onClick={downloadMemberDirectory}><FileSpreadsheet size={15}/> Export directory</button></div><div className="member-directory">{dashboard.members.map((member) => <div className="member-directory-card" key={member.id}><span className="avatar-mini">{member.member_code}</span><div className="member-directory-main"><strong>{member.display_name}</strong><small>Account status: Provisioned</small></div><span className={member.role === 'admin' ? 'tiny-tag' : 'member-tag'}>{member.role === 'admin' ? 'ADMIN' : 'MEMBER'}</span></div>)}</div><p className="permission-note"><LockKeyhole size={14}/> This directory never displays passwords. Passwords are entered locally during account setup. No password-reset feature is enabled. Aman remains the sole administrator.</p></section>}
        </main>
        <footer className="dashboard-footer">PHYSICS DIGITAL HUB <span>·</span> PRIVATE MEMBER AREA <span>·</span> POWERED BY AMAN ALAM AI</footer>
        {toast && <div className="toast"><Check size={16}/>{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      {screen === 'welcome' && <main className="intro-screen welcome-screen">
        <div className="top-meta"><span className="school-lockup"><img src="/assets/sks-school-crest.webp" alt=""/><School size={14}/> S.K.S PUBLIC SCHOOL</span><span>ANNUAL EXHIBITION · PHYSICS</span></div>
        <div className="welcome-layout">
          <div className="welcome-copy"><div className="live-label"><span/> SCHOOL PROJECT PRESENTATION</div><p className="pretitle">PROUDLY PRESENTS</p><h1>WELCOME TO<br/><span>PHYSICS DIGITAL HUB</span></h1><p className="welcome-subtitle">Discover the Science Behind <strong>Hydraulic Power.</strong></p><div className="welcome-rule"><span/><small>A SCHOOL ANNUAL EXHIBITION PROJECT</small></div><p className="powered-credit">POWERED BY <strong>AMAN ALAM AI</strong></p></div>
          <div className="welcome-art"><div className="art-orbit orbit-a"/><div className="art-orbit orbit-b"/><div className="crest-frame"><img src="/assets/sks-school-crest.webp" alt="S.K.S Public School emblem with the motto Knowledge, Wisdom, Success"/></div><CraneBlueprint/><div className="art-corner corner-one"/><div className="art-corner corner-two"/></div>
        </div>
        <div className="intro-bottom"><span>HYDRAULIC CONSTRUCTION CRANE</span><span className="intro-progress"><i/></span><span>01 / 03</span></div>
      </main>}

      {screen === 'members' && <main className="intro-screen members-screen">
        <div className="members-header"><p className="eyebrow">THE TEAM BEHIND THE MODEL</p><h1>BUILT BY <span>SIX.</span><br/>DRIVEN BY ONE VISION.</h1><p>Meet the project team of S.K.S Public School.</p></div>
        <div className="credits-list">{MEMBERS.map((member, index) => <div className="credit-line" key={member.code} style={{ animationDelay: `${index * 560}ms` }}><span className="credit-number">{member.code}</span><span className="credit-name">{member.name}</span><span className="credit-mark"/></div>)}</div>
        <div className="team-tagline"><span/> SIX MEMBERS. ONE VISION. <strong>POWERED BY AMAN ALAM AI.</strong></div>
        <div className="intro-bottom"><span>PROJECT CREDITS</span><span className="intro-progress"><i className="progress-two"/></span><span>02 / 03</span></div>
      </main>}

      {screen === 'video' && <main className="video-experience">
        <header className="public-header"><div className="public-brand"><img src="/assets/sks-school-crest.webp" alt="S.K.S Public School logo"/><div><strong>PHYSICS DIGITAL HUB</strong><span>S.K.S PUBLIC SCHOOL · ANNUAL EXHIBITION</span></div></div><div className="public-header-right"><span className="project-chip"><span/> PROJECT LIVE</span><button className="icon-button member-entry" onClick={openMemberPortal} aria-label="Open member access" title="Member access"><UserRound size={19}/></button></div></header>
        <section className={`video-grid ${commentPanelOpen ? 'comments-open' : ''}`}>
          <div className="video-column"><div className="player-shell"><div className="player-topline"><span><i/> MAIN PROJECT FILM</span><span>PHYSICS DIGITAL HUB / 001</span></div>{vimeoEmbedUrl ? <><iframe ref={iframeRef} src={vimeoEmbedUrl} title="Hydraulic construction crane project video" loading="eager" allow="fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setVideoError(true)}/>{videoError && <div className="video-error-overlay"><p>Embedded playback is unavailable right now.</p><div>{vimeoId && <a href={`https://vimeo.com/${encodeURIComponent(vimeoId)}${vimeoHash ? `/${encodeURIComponent(vimeoHash)}` : ''}`} target="_blank" rel="noreferrer">OPEN VIDEO ON VIMEO <ExternalLink size={13}/></a>}{downloadUrl && <a href={downloadUrl} target="_blank" rel="noreferrer">DOWNLOAD MP4 <Download size={13}/></a>}<a href="/emergency.html">OPEN EMERGENCY VIDEO PAGE <ExternalLink size={13}/></a></div></div>}</> : <div className="video-placeholder"><div className="placeholder-rings"><div><Play size={28}/></div></div><p className="eyebrow">PROJECT VIDEO</p><h2>THE EXPLAINER FILM<br/><span>WILL APPEAR HERE</span></h2><p>The video player activates when the Vimeo video ID is configured.</p><span className="placeholder-code">VIDEO MODULE · READY FOR CONTENT</span></div>}</div>
            <div className="video-actions"><button className={liked ? 'like-button is-liked' : 'like-button'} onClick={() => void toggleLike()} disabled={busy}><Heart size={18} fill={liked ? 'currentColor' : 'none'}/><span>{liked ? 'LIKED' : 'LIKE'}</span><b>{likeCount.toLocaleString('en-IN')}</b></button><button className="comment-open" onClick={() => setCommentPanelOpen(!commentPanelOpen)} aria-expanded={commentPanelOpen} aria-controls="public-comments-panel"><MessageCircle size={18}/><span>COMMENTS</span><b>{comments.length}</b></button>{downloadUrl ? <a className="download-button" href={downloadUrl} target="_blank" rel="noreferrer"><Download size={17}/> DOWNLOAD MP4 <ExternalLink size={12}/></a> : <span className="download-pending"><ArrowDownToLine size={16}/> DOWNLOAD AVAILABLE SOON</span>}</div>
          </div>
          {commentPanelOpen && <section id="public-comments-panel" className="comments-panel" aria-label="Anonymous project comments" aria-live="polite"><div className="comments-heading"><div><p className="eyebrow">COMMUNITY</p><h2>Project comments</h2></div><button className="icon-button" onClick={() => setCommentPanelOpen(false)} aria-label="Close comments"><X size={18}/></button></div><form className="comment-form" onSubmit={submitComment}><textarea rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write an anonymous comment..." maxLength={500}/><div><small>Anonymous · Automatically removed after 72 hours</small><button className="primary-button" disabled={busy || !commentText.trim()} type="submit">Publish <ArrowRight size={15}/></button></div></form>{commentsError && <div className="inline-error"><span>{commentsError}</span><button onClick={() => setReloadCommentsTick((tick) => tick + 1)}><RefreshCw size={13}/> Retry</button></div>}<div className="comment-list">{comments.length ? comments.map((comment) => <article className="comment-card" key={comment.id}><div className="comment-avatar"><MessageCircle size={14}/></div><div><p>{comment.content}</p><small>ANONYMOUS · {formatTime(comment.created_at)}</small></div></article>) : <div className="empty-comments"><MessageCircle size={22}/><span>No comments yet. Start the conversation.</span></div>}</div></section>}
        </section>
        <footer className="public-footer compact-public-footer"><span>S.K.S PUBLIC SCHOOL</span><span>POWERED BY AMAN ALAM AI</span></footer>
      </main>}

      {memberPortalOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setMemberPortalOpen(false); }}><section className="access-modal"><button className="modal-close icon-button" onClick={() => setMemberPortalOpen(false)} aria-label="Close access panel"><X size={18}/></button><div className="modal-logo"><img src="/assets/sks-school-crest.webp" alt="S.K.S School crest"/></div><p className="eyebrow">PHYSICS DIGITAL HUB</p><h2>{memberStage === 'access' ? 'Choose your access' : memberStage === 'shared' ? 'Project member access' : memberStage === 'choose' ? 'Select your profile' : 'Member verification'}</h2><p className="modal-subtitle">{memberStage === 'access' ? 'Continue as a visitor or enter the private project area.' : memberStage === 'shared' ? 'Enter the shared website password to continue.' : memberStage === 'choose' ? 'Select your own name to continue.' : `Enter the individual password for ${selectedMember?.name ?? 'your account'}.`}</p>
            {memberStage === 'access' && <div className="access-choices"><button className="access-choice" onClick={() => { setMemberPortalOpen(false); setView('public'); setScreen('welcome'); }}><span className="choice-icon"><Eye size={20}/></span><span><strong>Viewer</strong><small>Open the public project experience</small></span><ArrowRight size={17}/></button><button className="access-choice" onClick={() => setMemberStage('shared')}><span className="choice-icon"><LockKeyhole size={20}/></span><span><strong>Project Member</strong><small>Access your private member profile</small></span><ArrowRight size={17}/></button></div>}
            {memberStage === 'shared' && <form className="modal-form" onSubmit={verifySharedPassword}><label>Shared website password<input autoComplete="current-password" type="password" value={sharedPassword} onChange={(e) => setSharedPassword(e.target.value)} placeholder="Enter shared password" required/></label><button className="primary-button full-button" type="submit" disabled={busy || isDemoMode}>{busy ? 'VERIFYING…' : 'VERIFY & CONTINUE'} <ArrowRight size={15}/></button>{isDemoMode && <small className="setup-note"><LockKeyhole size={13}/> Member login activates after Supabase setup.</small>}<button className="text-back" type="button" onClick={() => setMemberStage('access')}><ArrowLeft size={14}/> Back to access choices</button></form>}
            {memberStage === 'choose' && <div className="member-picker"><div className="member-card-grid">{MEMBERS.map((member) => <button className="member-card" key={member.code} onClick={() => { setSelectedMember(member); setMemberStage('individual'); }}><span>{member.code}</span><strong>{member.name}</strong><small>{member.role === 'admin' ? 'ADMINISTRATOR' : 'PROJECT MEMBER'}</small></button>)}</div><button className="text-back" onClick={() => setMemberStage('shared')}><ArrowLeft size={14}/> Back</button></div>}
            {memberStage === 'individual' && <form className="modal-form" onSubmit={signInMember}><div className="selected-member"><span>{selectedMember?.code}</span><strong>{selectedMember?.name}</strong><small>{selectedMember?.role === 'admin' ? 'ADMINISTRATOR' : 'PROJECT MEMBER'}</small></div><label>Individual password<input type="password" autoComplete="current-password" value={individualPassword} onChange={(e) => setIndividualPassword(e.target.value)} placeholder="Enter your individual password" required/></label><button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'SIGNING IN…' : 'OPEN PERSONAL PROFILE'} <ArrowRight size={15}/></button><button className="text-back" type="button" onClick={() => setMemberStage('choose')}><ArrowLeft size={14}/> Choose another member</button></form>}
            <div className="modal-security"><ShieldCheck size={14}/> Secure member access · Individual accounts</div>
          </section></div>}
      {toast && view === 'public' && <div className="toast"><Check size={16}/>{toast}</div>}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="metric-card"><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value.toLocaleString('en-IN')}</strong></div></div>;
}

function AnalyticsChart({ data }: { data: { date: string; visits: number; plays: number }[] }) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.visits, item.plays]));
  const labelEvery = Math.max(1, Math.ceil(data.length / 10));
  return <section className="analytics-chart"><div className="chart-heading"><strong>Daily activity</strong><div className="chart-legend"><span><i className="legend-visits"/> Page visits</span><span><i className="legend-plays"/> Video plays</span></div></div><div className="chart-bars">{data.map((item, index) => <div className="chart-day" key={item.date} title={`${item.date} · ${item.visits} visits · ${item.plays} plays`}><div className="chart-column"><i className="chart-visit-bar" style={{ height: `${Math.max(item.visits ? 3 : 0, item.visits / maxValue * 100)}%` }}/><i className="chart-play-bar" style={{ height: `${Math.max(item.plays ? 3 : 0, item.plays / maxValue * 100)}%` }}/></div><small>{index % labelEvery === 0 || index === data.length - 1 ? new Date(`${item.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</small></div>)}</div><p className="chart-footnote">Daily counts are grouped by date. Hover or tap a bar to inspect its totals.</p></section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><Activity size={20}/><span>{text}</span></div>;
}

export default App;
