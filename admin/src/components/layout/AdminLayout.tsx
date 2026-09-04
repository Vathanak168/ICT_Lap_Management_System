import { Outlet, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  Users, 
  Monitor, 
  LayoutDashboard, 
  LogOut, 
  Settings, 
  ShieldCheck,
  Loader2,
  AppWindow,
  ChevronDown,
  Menu,
  X,
  Building2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ToastProvider } from '../ui/Toast';

const AdminLayout = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Smart Branch & Year Persistence
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    return localStorage.getItem('admin_selected_branch') || 'BELTEI IS 25';
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return localStorage.getItem('admin_selected_year') || '2026-2027';
  });
  const [academicYears, setAcademicYears] = useState<{ year: string; is_active?: boolean }[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      
      // Auto resolve branch from user profile if not set in localStorage
      if (session?.user?.id && !localStorage.getItem('admin_selected_branch')) {
        supabase.from('profiles').select('branch').eq('id', session.user.id).single().then(({ data }) => {
          if (data?.branch) {
            setSelectedBranch(data.branch);
            localStorage.setItem('admin_selected_branch', data.branch);
          }
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const fetchYears = async () => {
      const { data } = await supabase.from('academic_years').select('year, is_active').order('year', { ascending: false });
      if (data && data.length > 0) {
        setAcademicYears(data);
        if (!localStorage.getItem('admin_selected_year')) {
          const active = data.find((y: any) => y.is_active);
          const yearToUse = active ? active.year : data[0].year;
          setSelectedYear(yearToUse);
          localStorage.setItem('admin_selected_year', yearToUse);
        }
      }
    };
    fetchYears();

    return () => subscription.unsubscribe();
  }, []);

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem('admin_selected_branch', branch);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    localStorage.setItem('admin_selected_year', year);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <ShieldCheck size={28} className="text-blue-500" />
          </div>
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <p className="text-sm font-khmer text-slate-400">កំពុងដំណើរការ Admin Portal...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { label: 'ទំព័រដើម', icon: <LayoutDashboard size={19} />, path: '/' },
    { label: 'សិស្ស', icon: <Users size={19} />, path: '/students' },
    { label: 'ថ្នាក់រៀន', icon: <Monitor size={19} />, path: '/classes' },
    { label: 'កុំព្យូទ័រ & Lab', icon: <Monitor size={19} />, path: '/labs' },
    { label: 'ការសិក្សា', icon: <Sparkles size={19} />, path: '/academic' },
    { label: 'អ្នកប្រើប្រាស់', icon: <Users size={19} />, path: '/users' },
    { label: 'Mini App', icon: <AppWindow size={19} />, path: '/miniapps' },
    { label: 'ការកំណត់', icon: <Settings size={19} />, path: '/settings' },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-slate-900 text-slate-300 flex-col shadow-2xl z-30 hidden md:flex border-r border-slate-800/80 shrink-0">
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/40">
            <h1 className="text-base font-bold text-white flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
                <ShieldCheck size={20} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-sans font-bold tracking-tight text-white leading-tight">BELTEI ICT</span>
                <span className="text-[10px] font-khmer text-blue-400 font-semibold tracking-wider uppercase">Admin Portal</span>
              </div>
            </h1>
          </div>

          <div className="flex-1 py-5 px-3 flex flex-col gap-1 overflow-y-auto">
            <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-khmer">
              ម៉ឺនុយមេ
            </div>
            {navItems.map((item, i) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={i}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold' 
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className={`transition-transform duration-200 ${isActive ? 'scale-110 text-white' : 'group-hover:scale-110 text-slate-400 group-hover:text-blue-400'}`}>
                    {item.icon}
                  </span>
                  <span className="font-medium font-khmer text-sm mt-0.5">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-800/80 bg-slate-950/20">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-3.5 py-2.5 w-full rounded-xl text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-colors font-khmer text-sm"
            >
              <LogOut size={18} />
              <span>ចាកចេញពីប្រព័ន្ធ</span>
            </button>
          </div>
        </aside>

        {/* Mobile Drawer Backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Drawer Menu */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <ShieldCheck size={18} />
              </div>
              <span className="font-bold text-white font-khmer">Admin Portal</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
            {navItems.map((item, i) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={i}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-khmer transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-800">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-red-400 hover:bg-red-500/10 font-khmer text-sm"
            >
              <LogOut size={18} />
              <span>ចាកចេញ</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
          {/* Top Header */}
          <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 shadow-xs z-20 sticky top-0">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden transition-colors"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>

              {/* Branch Selector Pill */}
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-xl text-xs sm:text-sm font-khmer font-semibold transition-all shadow-2xs cursor-pointer">
                    <Building2 size={15} className="text-blue-600 shrink-0" />
                    <select 
                      className="appearance-none bg-transparent outline-none cursor-pointer w-full text-slate-800 font-medium font-khmer"
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                    >
                      <option value="All">គ្រប់សាខាទាំងអស់</option>
                      {Array.from({ length: 32 }, (_, i) => (
                        <option key={i + 1} value={`BELTEI IS ${i + 1}`}>
                          BELTEI IS {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>

                {/* Academic Year Selector Pill */}
                <div className="relative group hidden sm:block">
                  <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-xl text-xs sm:text-sm font-khmer font-semibold transition-all shadow-2xs cursor-pointer">
                    <Calendar size={15} className="text-indigo-600 shrink-0" />
                    <select 
                      className="appearance-none bg-transparent outline-none cursor-pointer w-full text-slate-800 font-medium font-khmer"
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                    >
                      <option value="All">គ្រប់ឆ្នាំសិក្សា</option>
                      {academicYears.map((ay, idx) => (
                        <option key={idx} value={ay.year}>{ay.year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile pill & User info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200 transition-colors">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 font-sans leading-none">{session.user?.email}</p>
                  <p className="text-[10px] text-blue-600 font-khmer font-semibold mt-0.5">Admin Administrator</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs border-2 border-white uppercase">
                  {session.user?.email?.[0] || 'A'}
                </div>
              </div>
            </div>
          </header>

          {/* Page Body */}
          <div className="flex-1 overflow-auto bg-slate-50/60 p-4 sm:p-6 lg:p-8">
            <Outlet context={{ selectedBranch, selectedYear }} />
          </div>
        </main>
      </div>
    </ToastProvider>
  );
};

export default AdminLayout;
