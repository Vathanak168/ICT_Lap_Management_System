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
    { name: 'ទិដ្ឋភាពទូទៅ', path: '/', icon: <Home size={18} /> },
    { name: 'ថ្នាក់រៀន', path: '/classes', icon: <Users size={18} /> },
    { name: 'សិស្ស', path: '/students', icon: <User size={18} /> },
    { name: 'សិស្សប្តូរវេន', path: '/shift-switching', icon: <ArrowLeftRight size={18} /> },
    { name: 'វត្តមាន', path: '/attendance', icon: <CheckSquare size={18} /> },
    { name: 'ប្លង់តុ', path: '/seating', icon: <Monitor size={18} /> },
    { name: 'ពិន្ទុ', path: '/grades', icon: <Table size={18} /> },
  ];

  const teachingNavItems = [
    { name: 'ចាប់ផ្តើមបង្រៀន', path: '/teaching/today', icon: <Zap size={18} /> },
    { name: 'កាលវិភាគ', path: '/teaching/schedule', icon: <CalendarDays size={18} /> },
    { name: 'ស្ថានភាពបង្រៀន', path: '/teaching/progress', icon: <TrendingUp size={18} /> },
    { name: 'រៀបចំមេរៀន', path: '/teaching/curriculum', icon: <Library size={18} /> },
  ];

  const toolNavItems = [
    { name: 'បញ្ហាកុំព្យូទ័រ', path: '/issues', icon: <Wrench size={18} /> },
    { name: 'PC Sync', path: '/pc-sync', icon: <DownloadCloud size={18} /> },
    { name: 'Mini App', path: '/miniapps', icon: <AppWindow size={18} /> },
  ];

  const renderNavItem = (item: { name: string; path: string; icon: any }) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-[13px] leading-[1.6] transition-colors duration-100 ease-out select-none ${
          isActive
            ? 'bg-blue-50/95 text-primary font-bold shadow-2xs border border-blue-150/70'
            : 'text-secondary-text font-medium hover:bg-surface-hover hover:text-main-text border border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`shrink-0 transition-colors duration-100 ${isActive ? 'text-primary' : 'text-secondary-text/80 group-hover:text-main-text'}`}>
            {item.icon}
          </span>
          <span className="whitespace-nowrap overflow-visible leading-[1.6]">{item.name}</span>
        </>
      )}
    </NavLink>
  );

  const renderSectionHeader = (label: string) => (
    <div className="pt-3.5 pb-1 px-3 mt-1.5 border-t border-border/60">
      <span className="text-[11px] font-bold text-secondary-text/70 uppercase tracking-wider">{label}</span>
    </div>
  );

  return (
    <aside className="w-[240px] bg-surface border-r border-border flex flex-col h-full shrink-0 z-10 transition-all duration-300 print:hidden pt-3.5 shadow-2xs">
      <nav className="flex-1 px-2.5 pt-1.5 space-y-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200/80 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        {mainNavItems.map(renderNavItem)}

        {renderSectionHeader('ការបង្រៀន')}
        {teachingNavItems.map(renderNavItem)}

        {renderSectionHeader('ឧបករណ៍')}
        {toolNavItems.map(renderNavItem)}
      </nav>

      <div className="p-2.5 border-t border-border/70 shrink-0">
        <NavLink 
          to="/settings" 
          className={({ isActive }) => 
            `group flex items-center gap-3 px-3 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-[13px] leading-[1.6] transition-colors duration-100 ease-out w-full select-none ${
              isActive 
                ? 'bg-blue-50/95 text-primary font-bold shadow-2xs border border-blue-150/70' 
                : 'text-secondary-text font-medium hover:bg-surface-hover hover:text-main-text border border-transparent'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`shrink-0 transition-colors duration-100 ${isActive ? 'text-primary' : 'text-secondary-text/80 group-hover:text-main-text'}`}>
                <Settings size={18} />
              </span>
              <span className="whitespace-nowrap overflow-visible leading-[1.6]">ការកំណត់</span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
