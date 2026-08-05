import React from 'react';

export function Table({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-white border border-border rounded-xl shadow-soft overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead className="bg-background-selected border-b border-border">{children}</thead>;
}

export function TableRow({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return <tr className={`border-b border-border last:border-0 hover:bg-gray-50 transition-colors ${className}`}>{children}</tr>;
}

export function TableHead({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return <th className={`px-4 py-3 text-xs font-medium text-secondary-text uppercase tracking-wider whitespace-nowrap ${className}`}>{children}</th>;
}

export function TableCell({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return <td className={`px-4 py-4 text-sm text-primary ${className}`}>{children}</td>;
}
