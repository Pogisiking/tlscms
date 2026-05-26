import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{title}</h1>
        {description && (
          <p className="text-gray-500 dark:text-gray-400 font-bold tracking-tight uppercase text-[11px] mt-1 opacity-60">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
