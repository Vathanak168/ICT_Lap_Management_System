import type { ReactNode } from 'react';

interface PageHeaderProps {
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({ children, className = '' }: PageHeaderProps) {
  if (!children) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 mb-6 w-full ${className}`}>
      {children}
    </div>
  );
}
