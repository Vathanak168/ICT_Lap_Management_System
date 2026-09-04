import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  ArrowUpRight,
  Globe2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface MiniApp {
  id: string;
  name: string;
  url: string;
  icon_url: string;
  branch: string;
  created_at?: string;
}

type AppScope = 'all' | 'general' | 'branch';

const normalizeAppUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

const MiniAppIcon = ({ app }: { app: MiniApp }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(app.icon_url?.trim()) && !imageFailed;

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      {showImage ? (
        <img src={app.icon_url} alt="" className="h-10 w-10 object-contain" onError={() => setImageFailed(true)} />
      ) : (
        <AppWindow size={24} className="text-[#2a5298]" />
      )}
    </span>
  );
};

const MiniAppCard = ({ app }: { app: MiniApp }) => {
  const safeUrl = normalizeAppUrl(app.url);
  const host = safeUrl?.hostname.replace(/^www\./, '') || 'URL មិនត្រឹមត្រូវ';
  const isGeneral = app.branch === 'ទូទៅ';
  const cardClass = 'group flex min-h-[164px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md';
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <MiniAppIcon app={app} />
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isGeneral ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
          {isGeneral ? 'ទូទៅ' : app.branch}
        </span>
      </div>
      <div className="mt-4 min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-[#2a5298]">{app.name}</h3>
        <p className={`mt-1.5 flex items-center gap-1.5 truncate text-[11px] ${safeUrl ? 'text-slate-400' : 'text-red-500'}`}>
          {safeUrl ? <Globe2 size={12} className="shrink-0" /> : <ShieldAlert size={12} className="shrink-0" />} {host}
        </p>
      </div>
      <div className={`mt-3 flex items-center justify-between border-t pt-3 text-xs font-bold ${safeUrl ? 'border-slate-100 text-[#2a5298]' : 'border-red-100 text-red-500'}`}>
        <span>{safeUrl ? 'បើកកម្មវិធី' : 'មិនអាចបើកបាន'}</span>
        {safeUrl && <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
      </div>
    </>
  );

  if (!safeUrl) return <div className={`${cardClass} cursor-not-allowed border-red-100 bg-red-50/30`}>{content}</div>;

  return (
    <a href={safeUrl.href} target="_blank" rel="noopener noreferrer" className={cardClass}>
      {content}
    </a>
  );
};

const MiniApps = () => {
  const { branch } = useAuth();
  const [apps, setApps] = useState<MiniApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [scope, setScope] = useState<AppScope>('all');

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const branchFilters = Array.from(new Set(['ទូទៅ', branch].filter(Boolean))) as string[];
      const { data, error } = await supabase
        .from('mini_apps')
        .select('id,name,url,icon_url,branch,created_at')
        .in('branch', branchFilters)
        .order('name', { ascending: true });

      if (error) throw error;
      setApps((data || []) as MiniApp[]);
    } catch (error: any) {
      console.error('Error fetching mini apps:', error);
      setErrorMessage(error?.message || 'មិនអាចទាញយក Mini App បាន។');
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => { void fetchApps(); }, [fetchApps]);

  const counts = useMemo(() => ({
    all: apps.length,
    general: apps.filter(app => app.branch === 'ទូទៅ').length,
    branch: apps.filter(app => app.branch !== 'ទូទៅ').length,
  }), [apps]);

  const visibleApps = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return apps.filter(app => {
      if (scope === 'general' && app.branch !== 'ទូទៅ') return false;
      if (scope === 'branch' && app.branch === 'ទូទៅ') return false;
      if (!query) return true;
      const host = normalizeAppUrl(app.url)?.hostname || '';
      return `${app.name} ${host}`.toLocaleLowerCase().includes(query);
    });
  }, [apps, scope, searchText]);

  const filters: Array<{ value: AppScope; label: string; count: number }> = [
    { value: 'all', label: 'ទាំងអស់', count: counts.all },
    { value: 'general', label: 'ប្រើរួម', count: counts.general },
    ...(branch ? [{ value: 'branch' as AppScope, label: 'សាខារបស់ខ្ញុំ', count: counts.branch }] : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#183b72] via-[#2a5298] to-[#3d6db5] px-5 py-5 text-white shadow-sm md:px-7 md:py-6">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20"><AppWindow size={24} /></span>
            <div><div className="flex items-center gap-2"><h1 className="text-xl font-bold md:text-2xl">Mini Apps</h1><Sparkles size={16} className="text-blue-200" /></div><p className="mt-1 text-xs leading-5 text-blue-100">ឧបករណ៍ និងកម្មវិធីដែលប្រើញឹកញាប់ក្នុងការបង្រៀន</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">{apps.length} កម្មវិធី</span>
            <button type="button" onClick={() => void fetchApps()} disabled={loading} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-60" title="ទាញយកឡើងវិញ"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="ស្វែងរកឈ្មោះកម្មវិធី ឬ Website..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {filters.map(filter => (
              <button key={filter.value} type="button" onClick={() => setScope(filter.value)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all ${scope === filter.value ? 'bg-white text-[#2a5298] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {filter.label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${scope === filter.value ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span className="flex items-center gap-2"><ShieldAlert size={18} /> {errorMessage}</span><button type="button" onClick={() => void fetchApps()} className="shrink-0 text-xs font-bold underline">សាកម្តងទៀត</button></div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[164px] animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="h-14 w-14 rounded-2xl bg-slate-100" /><div className="mt-4 h-4 w-2/3 rounded bg-slate-100" /><div className="mt-2 h-3 w-1/2 rounded bg-slate-100" /></div>)}
        </div>
      ) : visibleApps.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleApps.map(app => <MiniAppCard key={app.id} app={app} />)}
        </div>
      ) : (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#2a5298]"><AppWindow size={27} /></span>
          <h2 className="mt-4 text-base font-bold text-slate-800">{apps.length === 0 ? 'មិនទាន់មាន Mini App' : 'រកមិនឃើញកម្មវិធី'}</h2>
          <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">{apps.length === 0 ? 'Admin មិនទាន់បានបន្ថែមកម្មវិធីសម្រាប់សាខានេះទេ។' : 'សាកល្បងប្តូរពាក្យស្វែងរក ឬជ្រើសក្រុមកម្មវិធីផ្សេង។'}</p>
          {searchText && <button type="button" onClick={() => setSearchText('')} className="mt-3 text-xs font-bold text-[#2a5298]">សម្អាតការស្វែងរក</button>}
        </div>
      )}

      {!loading && visibleApps.length > 0 && (
        <p className="text-center text-[11px] text-slate-400"><Globe2 size={12} className="mr-1 inline" /> កម្មវិធីនឹងបើកក្នុង Tab ថ្មី។ URL មិនមានសុវត្ថិភាពនឹងត្រូវបានរារាំង។</p>
      )}
    </div>
  );
};

export default MiniApps;
