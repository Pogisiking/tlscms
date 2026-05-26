import { useEffect, useState } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CreditCard,
  Building2,
  Calendar,
  ArrowDownRight,
  Wallet,
  Clock,
  CheckCircle2,
} from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/DataCard';
import { ChartCard } from '../components/dashboard/ChartCard';
import {
  MonthlyCollectionsChart,
  LoanDistributionChart,
  FinancialTrendsChart,
  EarningsTrendsChart,
  DelinquencyReportsChart,
} from '../components/dashboard/charts';

import type {
  DashboardMetrics,
  ActiveLoanView,
  CutoffSummaryView,
  MonthlyCollectionsPoint,
  LoanDistributionPoint,
  FinancialTrendPoint,
  EarningsTrendPoint,
  DelinquencyReportPoint,
} from '../types/database';

import { formatCurrency, formatDate } from '../utils/formatters';

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activeLoans, setActiveLoans] = useState<ActiveLoanView[]>([]);
  const [cutoffs, setCutoffs] = useState<CutoffSummaryView[]>([]);

  const [monthlyCollections, setMonthlyCollections] = useState<MonthlyCollectionsPoint[]>([]);
  const [loanDistribution, setLoanDistribution] = useState<LoanDistributionPoint[]>([]);
  const [financialTrends, setFinancialTrends] = useState<FinancialTrendPoint[]>([]);
  const [earningsTrends, setEarningsTrends] = useState<EarningsTrendPoint[]>([]);
  const [delinquencyReports, setDelinquencyReports] = useState<DelinquencyReportPoint[]>([]);

  const [loading, setLoading] = useState(true);

  // Preserve scroll position across refresh/back-navigation for a better UX.
  useEffect(() => {
    const key = 'dashboard_scroll_y';

    const savedY = sessionStorage.getItem(key);
    if (savedY) {
      const y = Number(savedY);
      if (Number.isFinite(y)) {
        window.scrollTo({ top: y });
      }
    }

    const onScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    void fetchDashboardData();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    const runFetches = async (withAuth: boolean) => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
      if (withAuth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const [
        metricsRes,
        loansRes,
        cutoffsRes,
        monthlyRes,
        distributionRes,
        financialRes,
        earningsRes,
        delinquencyRes,
      ] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/metrics`, { headers }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/active-loans`, { headers }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/cutoffs`, { headers }),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/monthly-collections`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/loan-distribution`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/financial-trends`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/earnings-trends`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/delinquency-reports`,
          { headers },
        ),
      ]);

      return {
        metricsRes,
        loansRes,
        cutoffsRes,
        monthlyRes,
        distributionRes,
        financialRes,
        earningsRes,
        delinquencyRes,
      };
    };

    try {
      // Try with auth first; if the function is configured to reject auth (or token is invalid), fall back to public.
      const first = await runFetches(true);

      const shouldRetryWithoutAuth =
        first.metricsRes.status === 401 ||
        first.loansRes.status === 401 ||
        first.cutoffsRes.status === 401 ||
        first.monthlyRes.status === 401 ||
        first.distributionRes.status === 401 ||
        first.financialRes.status === 401 ||
        first.earningsRes.status === 401 ||
        first.delinquencyRes.status === 401;

      const res = shouldRetryWithoutAuth ? await runFetches(false) : first;

      if (res.metricsRes.ok) setMetrics(await res.metricsRes.json());
      if (res.loansRes.ok) setActiveLoans((await res.loansRes.json()) || []);
      if (res.cutoffsRes.ok) setCutoffs((await res.cutoffsRes.json()) || []);

      if (res.monthlyRes.ok) setMonthlyCollections((await res.monthlyRes.json()) || []);
      if (res.distributionRes.ok) setLoanDistribution((await res.distributionRes.json()) || []);
      if (res.financialRes.ok) setFinancialTrends((await res.financialRes.json()) || []);
      if (res.earningsRes.ok) setEarningsTrends((await res.earningsRes.json()) || []);
      if (res.delinquencyRes.ok) setDelinquencyReports((await res.delinquencyRes.json()) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const m: any = metrics;

  const cardStyles: Record<string, string> = {
    blue: 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-blue-500/5 ring-1 ring-blue-500/10',
    green: 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-emerald-500/5 ring-1 ring-emerald-500/10',
    yellow: 'bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-amber-500/5 ring-1 ring-amber-500/10',
    purple: 'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20 shadow-purple-500/5 ring-1 ring-purple-500/10',
    red: 'bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-rose-500/5 ring-1 ring-rose-500/10',
    gray: 'bg-slate-500/5 text-slate-600 dark:text-slate-400 border-slate-500/20 shadow-slate-500/5 ring-1 ring-slate-500/10',
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div className={`p-6 rounded-[2.5rem] border backdrop-blur-2xl relative overflow-hidden group transition-all duration-700 hover:shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] hover:-translate-y-2 ${cardStyles[color]}`}>
      <div className="absolute -right-4 -bottom-4 opacity-[0.08] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
        <Icon className="w-24 h-24" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-inherit transition-transform duration-500 group-hover:scale-110">
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">{title}</p>
        </div>
        <h3 className="text-2xl font-black tracking-tighter mb-1">{value}</h3>
        {subtitle && <p className="text-[11px] font-bold opacity-60 flex items-center gap-1">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 bg-slate-50/50 dark:bg-transparent min-h-screen">
      <PageHeader title="Overview" description="Real-time cooperative financial intelligence" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <MetricCard
          title="Total Share Capital"
          value={formatCurrency(safeNumber(m?.total_share_capital, 0))}
          icon={Building2}
          color="blue"
        />
        <MetricCard
          title="Cash on Hand"
          value={formatCurrency(safeNumber(m?.cash_on_hand, 0))}
          icon={Wallet}
          color="gray"
        />
        <MetricCard
          title="Active Loans"
          value={safeNumber(m?.active_loans, 0)}
          subtitle={`${formatCurrency(safeNumber(m?.outstanding_balance, 0))} outstanding`}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Outstanding"
          value={formatCurrency(safeNumber(m?.outstanding_balance, 0))}
          icon={CreditCard}
          color="yellow"
        />
        <MetricCard
          title="Due This Cutoff"
          value={safeNumber(m?.due_this_cutoff, m?.due_today, 0)}
          icon={Clock}
          color="blue"
        />
        <MetricCard
          title="Collected"
          value={formatCurrency(safeNumber(m?.collected_this_cutoff, 0))}
          icon={CheckCircle2}
          color="green"
        />
        <MetricCard
          title="Coop Earnings"
          value={formatCurrency(safeNumber(m?.total_earnings, 0))}
          icon={TrendingUp}
          color="purple"
        />
        <MetricCard
          title="Delinquent"
          value={safeNumber(m?.delayed_payments, m?.overdue_payments, 0)}
          icon={AlertCircle}
          color="red"
        />
      </div>

      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">Market Analytics</h2>
            <p className="text-gray-500 font-bold tracking-tight uppercase text-[11px] mt-1 opacity-60">Portfolio Performance Matrix</p>
          </div>
          <div className="px-5 py-2.5 text-[11px] font-black uppercase bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 cursor-default flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Live Data Stream
          </div>
        </div>
        
        <div className="flex flex-col gap-10">
          {[
            { 
              title: "Monthly Collections", 
              data: monthlyCollections, 
              Chart: MonthlyCollectionsChart, 
              color: "blue", 
              icon: Calendar,
              subtitle: "Cash flow velocity over the trailing 12 months"
            },
            { 
              title: "Loan Distribution", 
              data: loanDistribution, 
              Chart: LoanDistributionChart, 
              color: "emerald", 
              icon: DollarSign,
              subtitle: "Asset allocation by risk profile and status"
            },
            { 
              title: "Financial Trends", 
              data: financialTrends, 
              Chart: FinancialTrendsChart, 
              color: "amber", 
              icon: CreditCard,
              subtitle: "Comparative analysis of forecast vs actuals"
            },
            { 
              title: "Earnings Trends", 
              data: earningsTrends, 
              Chart: EarningsTrendsChart, 
              color: "purple", 
              icon: TrendingUp,
              subtitle: "Projected dividend yields and net interest income"
            },
          ].map((item, idx) => (
            <ChartCard
              key={idx}
              title={item.title}
              subtitle={item.subtitle}
              icon={<item.icon className="w-5 h-5" />}
              className={`
                rounded-[3rem] border transition-all duration-700 hover:scale-[1.01]
                ${item.color === 'blue' ? 'border-blue-500/10 bg-white dark:bg-slate-900 shadow-2xl shadow-blue-500/5' : ''}
                ${item.color === 'emerald' ? 'border-emerald-500/10 bg-white dark:bg-slate-900 shadow-2xl shadow-emerald-500/5' : ''}
                ${item.color === 'amber' ? 'border-amber-500/10 bg-white dark:bg-slate-900 shadow-2xl shadow-amber-500/5' : ''}
                ${item.color === 'purple' ? 'border-purple-500/10 bg-white dark:bg-slate-900 shadow-2xl shadow-purple-500/5' : ''}
              `}
            >
              <div className="relative group/chart p-2">
                {/* Ambient Radial Glow */}
                <div className={`absolute -top-24 -left-24 w-64 h-64 blur-[120px] opacity-[0.12] pointer-events-none rounded-full
                  ${item.color === 'blue' ? 'bg-blue-600' : ''}
                  ${item.color === 'emerald' ? 'bg-emerald-600' : ''}
                  ${item.color === 'amber' ? 'bg-amber-600' : ''}
                  ${item.color === 'purple' ? 'bg-purple-600' : ''}
                `} />
                
                {item.data.length === 0 ? (
                  <div className="text-sm text-gray-400 py-32 text-center font-bold tracking-tight uppercase opacity-40">
                    Awaiting Data Stream...
                  </div>
                ) : (
                  <div className="relative z-10 p-4 h-[300px]">
                    <item.Chart data={item.data as any} />
                  </div>
                )}
              </div>
            </ChartCard>
          ))}

          <div className="hidden lg:block" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="none" className="rounded-[2.5rem] overflow-hidden border-gray-100 dark:border-gray-800 shadow-2xl shadow-gray-200/20">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Portfolio Activity</h2>
          </div>
          <div className="p-8">
            {activeLoans.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No active loans</div>
            ) : (
              <div className="space-y-5">
                {activeLoans.slice(0, 5).map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between p-5 bg-gray-50/50 dark:bg-gray-800/50 rounded-[1.5rem] hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300 group cursor-default shadow-sm hover:shadow-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{loan.member_name}</p>
                      <p className="text-sm text-gray-500">
                        {loan.loan_id} - {formatCurrency(loan.principal_amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">{loan.payments_made}/10</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        {loan.missed_payment_count > 0 && (
                          <span className="text-rose-500">
                            <ArrowDownRight className="w-4 h-4" />
                          </span>
                        )}
                        {loan.remaining_balance.toLocaleString()} remaining
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card padding="none" className="rounded-[2rem] overflow-hidden border-gray-100 dark:border-gray-800">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Cutoff Periods</h2>
          </div>
          <div className="p-6">
            {cutoffs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No cutoff periods</div>
            ) : (
              <div className="space-y-4">
                {cutoffs.slice(0, 4).map((cutoff) => (
                  <div
                    key={cutoff.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all cursor-default"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{formatDate(cutoff.cutoff_date)}</p>
                      <p className="text-sm text-gray-500 capitalize">{cutoff.cutoff_type.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cutoff.status === 'open'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {cutoff.status}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">{cutoff.borrower_count} borrowers</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
