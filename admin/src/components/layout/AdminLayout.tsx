import { Outlet, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Monitor, Settings, LogOut, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AdminLayout = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    { label: 'ទំព័រដើម (Dashboard)', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'អ្នកប្រើប្រាស់ (Users)', icon: <Users size={20} />, path: '/users' },
    { label: 'កុំព្យូទ័រ (Lab PCs)', icon: <Monitor size={20} />, path: '/labs' },
    { label: 'ការកំណត់ (Settings)', icon: <Settings size={20} />, path: '/settings' },
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
            <span className="font-medium font-khmer text-sm mt-0.5">ចាកចេញ (Sign Out)</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 sticky top-0">
          <div className="flex items-center md:hidden">
            <span className="font-bold text-lg text-slate-800">Admin Portal</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-700">{session.user?.email}</p>
                <p className="text-xs text-slate-500 font-khmer">អ្នកគ្រប់គ្រង (Admin)</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex-center font-bold border-2 border-white shadow-sm uppercase">
                {session.user?.email?.[0] || 'A'}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
