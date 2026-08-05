import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface LayoutProps {
  children?: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background print:h-auto print:overflow-visible print:bg-white">
      <Topbar />
      <div className="flex-1 flex overflow-hidden relative print:overflow-visible">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-5 lg:p-5 print:overflow-visible print:p-0">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default Layout;
