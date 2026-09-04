import { NavLink } from 'react-router-dom';
import { 
  Users, 
  CheckSquare, 
  Table, 
  Monitor, 
  Wrench,
  Settings,
  Home,
  ArrowLeftRight,
  User,
  AppWindow,
  DownloadCloud,
  Zap,
  TrendingUp,
  Library,
  CalendarDays
} from 'lucide-react';

const Sidebar = () => {
  const mainNavItems = [
    { name: 'ទិដ្ឋភាពទូទៅ', path: '/', icon: <Home size={20} /> },
    { name: 'ថ្នាក់រៀន', path: '/classes', icon: <Users size={20} /> },
    { name: 'សិស្ស', path: '/students', icon: <User size={20} /> },
    { name: 'សិស្សប្តូរវេន', path: '/shift-switching', icon: <ArrowLeftRight size={20} /> },
    { name: 'វត្តមាន', path: '/attendance', icon: <CheckSquare size={20} /> },
    { name: 'ប្លង់តុ', path: '/seating', icon: <Monitor size={20} /> },
    { name: 'ពិន្ទុ', path: '/grades', icon: <Table size={20} /> },
  ];

  const teachingNavItems = [
    { name: 'ចាប់ផ្តើមបង្រៀន', path: '/teaching/today', icon: <Zap size={20} /> },
    { name: 'កាលវិភាគ', path: '/teaching/schedule', icon: <CalendarDays size={20} /> },
    { name: 'ស្ថានភាពបង្រៀន', path: '/teaching/progress', icon: <TrendingUp size={20} /> },
    { name: 'រៀបចំមេរៀន', path: '/teaching/curriculum', icon: <Library size={20} /> },
  ];

  const toolNavItems = [
    { name: 'បញ្ហាកុំព្យូទ័រ', path: '/issues', icon: <Wrench size={20} /> },
    { name: 'PC Sync', path: '/pc-sync', icon: <DownloadCloud size={20} /> },
    { name: 'Mini App', path: '/miniapps', icon: <AppWindow size={20} /> },
  ];

  const renderNavItem = (item: { name: string; path: string; icon: any }) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-blue-50 text-[#2a5298] font-bold'
            : 'text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <div className="absolute left-0 w-1 h-8 bg-[#2a5298] rounded-r-md"></div>}
          <span className="shrink-0">{item.icon}</span>
          <span>{item.name}</span>
        </>
      )}
    </NavLink>
  );

  const renderSectionHeader = (label: string) => (
    <div className="px-3 pt-4 pb-1.5">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em]">{label}</span>
    </div>
  );

  return (
    <aside className="w-[250px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0 z-10 transition-all duration-300 print:hidden pt-4 shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {mainNavItems.map(renderNavItem)}

        {renderSectionHeader('ការបង្រៀន')}
        {teachingNavItems.map(renderNavItem)}

        {renderSectionHeader('ឧបករណ៍')}
        {toolNavItems.map(renderNavItem)}
      </nav>

      <div className="px-4 pb-4 shrink-0">
        <NavLink 
          to="/settings" 
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full ${
              isActive 
                ? 'bg-blue-50 text-[#2a5298] font-bold' 
                : 'text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          <span className="shrink-0"><Settings size={20} /></span>
          <span>ការកំណត់</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
