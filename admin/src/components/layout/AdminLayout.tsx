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
  ChevronDown 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AdminLayout = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('None');
  const [selectedYear, setSelectedYear] = useState<string>('None');
  const [academicYears, setAcademicYears] = useState<{year: string}[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const fetchYears = async () => {
      const { data } = await supabase.from('academic_years').select('year').order('year', { ascending: false });
      if (data && data.length > 0) {
        setAcademicYears(data);
        const active = data.find((y: any) => y.is_active);
        setSelectedYear(active ? active.year : data[0].year);
      }
    };
    fetchYears();

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { label: 'ទំព័រដើម', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'ថ្នាក់រៀន', icon: <Monitor size={20} />, path: '/classes' },
    { label: 'សិស្ស', icon: <Users size={20} />, path: '/students' },
    { label: 'ការសិក្សា', icon: <Users size={20} />, path: '/academic' },
    { label: 'អ្នកប្រើប្រាស់', icon: <Users size={20} />, path: '/users' },
    { label: 'កុំព្យូទ័រ', icon: <Monitor size={20} />, path: '/labs' },
    { label: 'Mini App', icon: <AppWindow size={20} />, path: '/miniapps' },
    { label: 'ការកំណត់', icon: <Settings size={20} />, path: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20 hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900/50">
          <h1 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex-center shadow-lg shadow-blue-600/20">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <span className="font-khmer text-lg mt-1">Admin Portal</span>
          </h1>
        </div>
        <div className="flex-1 py-6 px-3 flex flex-col gap-1.5">
          {navItems.map((item, i) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={i}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium font-khmer text-sm mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 w-full rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium font-khmer text-sm mt-0.5">ចាកចេញ</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg text-slate-800 md:hidden">Admin Portal</span>
            <div className="hidden sm:flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600 font-khmer">សាខា៖</span>
                <div className="relative group">
                  <select 
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-lg text-sm min-w-[150px] font-khmer font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none hover:border-slate-300 transition-colors cursor-pointer"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option value="None">-- ជ្រើសរើសសាខា --</option>
                    <option value="All">ទាំងអស់ (All Branches)</option>
                    {Array.from({ length: 32 }, (_, i) => (
                      <option key={i + 1} value={`BELTEI IS ${i + 1}`}>
                        BELTEI IS {i + 1}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600 font-khmer">ឆ្នាំសិក្សា៖</span>
                <div className="relative group">
                  <select 
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-lg text-sm min-w-[120px] font-khmer font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none hover:border-slate-300 transition-colors cursor-pointer"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    <option value="None">-- ជ្រើសរើសឆ្នាំ --</option>
                    <option value="All">ទាំងអស់</option>
                    {academicYears.map((ay, idx) => (
                      <option key={idx} value={ay.year}>{ay.year}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-700">{session.user?.email}</p>
                <p className="text-xs text-slate-500 font-khmer">អ្នកគ្រប់គ្រង</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex-center font-bold border-2 border-white shadow-sm uppercase">
                {session.user?.email?.[0] || 'A'}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
          {/* Mobile Branch Filter */}
          <div className="sm:hidden mb-6 flex flex-col gap-4">
            <div>
              <span className="text-sm font-semibold text-slate-600 font-khmer">សាខា៖</span>
              <div className="relative group mt-1">
                <select 
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg w-full font-khmer font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none hover:border-slate-300 transition-colors cursor-pointer"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="None">-- ជ្រើសរើសសាខា --</option>
                  <option value="All">ទាំងអស់ (All Branches)</option>
                  {Array.from({ length: 32 }, (_, i) => (
                    <option key={i + 1} value={`BELTEI IS ${i + 1}`}>
                      BELTEI IS {i + 1}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            </div>
            
            <div>
              <span className="text-sm font-semibold text-slate-600 font-khmer">ឆ្នាំសិក្សា៖</span>
              <div className="relative group mt-1">
                <select 
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg w-full font-khmer font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none hover:border-slate-300 transition-colors cursor-pointer"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option value="None">-- ជ្រើសរើសឆ្នាំ --</option>
                  <option value="All">ទាំងអស់</option>
                  {academicYears.map((ay, idx) => (
                    <option key={idx} value={ay.year}>{ay.year}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            </div>
          </div>
          <Outlet context={{ selectedBranch, selectedYear }} />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
