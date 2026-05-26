import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const tooltipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(59,130,246,0.18)',
  borderRadius: 14,
  boxShadow: '0 14px 38px rgba(15,23,42,0.12)',
  color: '#0f172a',
};


const gridStroke = 'rgba(148,163,184,0.30)';
const tickFillLight = '#64748b';
const tickFillDark = '#94a3b8';


function axisTickStyle() {
  return {
    fill: tickFillLight,
    fontSize: 12,
  };
}



export function MonthlyCollectionsChart({
  data,
}: {
  data: Array<{ month: string; collected: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="barCollected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.95} />
          </linearGradient>
          <linearGradient id="barGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="4 6"
          stroke={gridStroke}
          strokeWidth={1}
        />

        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: tickFillLight, opacity: 0.9 }}
          tickLine={false}
          axisLine={{ stroke: gridStroke, strokeWidth: 1 }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: tickFillLight, opacity: 0.9 }}
          tickFormatter={(v) => String(v)}
          tickLine={false}
          axisLine={{ stroke: gridStroke, strokeWidth: 1 }}
        />

        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: unknown) => [`${Number(v).toLocaleString()}`, 'Collected']}
        />

        <Bar
          dataKey="collected"
          fill="url(#barCollected)"
          radius={[10, 10, 0, 0]}
          stroke="rgba(37,99,235,0.18)"
          strokeWidth={1}
        />

      </BarChart>
    </ResponsiveContainer>
  );
}

export function LoanDistributionChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: unknown) => [`${Number(value).toLocaleString()}`, 'Count']}
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={120}
          label={({ percent }: any) => `${Math.round((percent ?? 0) * 100)}%`}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={colors[idx % colors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FinancialTrendsChart({
  data,
}: {
  data: Array<{ month: string; outstanding: number; due: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => String(v)} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="outstanding"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={false}
          strokeLinecap="round"
        />
        <Line
          type="monotone"
          dataKey="due"
          stroke="#f59e0b"
          strokeWidth={3}
          dot={false}
          strokeLinecap="round"
        />

      </LineChart>
    </ResponsiveContainer>
  );
}

export function EarningsTrendsChart({
  data,
}: {
  data: Array<{ month: string; earnings: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => String(v)} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="earnings" stroke="#8b5cf6" strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DelinquencyReportsChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

