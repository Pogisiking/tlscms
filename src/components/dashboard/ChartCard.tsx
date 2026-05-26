import type { ReactNode } from 'react';

import { Card } from '../common/DataCard';

export function ChartCard({
  title,
  subtitle,
  icon,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="none" className={`overflow-hidden ${className}`}>
      <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        {icon ? (
          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800 text-gray-500">
            {icon}
          </div>
        ) : null}
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}

