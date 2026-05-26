import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple';
}

const colorStyles = {
  blue: 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-blue-500/5 ring-1 ring-blue-500/10',
  green: 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-emerald-500/5 ring-1 ring-emerald-500/10',
  red: 'bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-rose-500/5 ring-1 ring-rose-500/10',
  yellow: 'bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-amber-500/5 ring-1 ring-amber-500/10',
  gray: 'bg-slate-500/5 text-slate-600 dark:text-slate-400 border-slate-500/20 shadow-slate-500/5 ring-1 ring-slate-500/10',
  purple: 'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20 shadow-purple-500/5 ring-1 ring-purple-500/10',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = '',
  color = 'blue',
}: StatCardProps) {
  return (
    <div className={`p-6 rounded-[2.5rem] border backdrop-blur-2xl relative overflow-hidden group transition-all duration-700 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] hover:-translate-y-2 ${colorStyles[color]} ${className}`}>
      {icon && (
        <div className="absolute -right-4 -bottom-4 opacity-[0.08] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
          {icon}
        </div>
      )}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-tighter">{value}</p>
          {subtitle && (
            <p className="mt-1 text-[11px] font-bold opacity-60">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-sm font-medium ${
                  trend.value >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-sm text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-inherit transition-transform duration-500 group-hover:scale-110">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
