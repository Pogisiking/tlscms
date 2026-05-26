import { useEffect, useMemo, useState } from 'react';
import { Shield, Lock, Unlock, RefreshCw, Download, Plus, TrendingUp, Users, Wallet, PieChart } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Badge, Table } from '../components/common/DataCard';
import type {
  DividendPeriod,
  DividendMemberAllocation,
  DividendPeriodStatus,
} from '../types/database';
import { formatCurrency, formatDate } from '../utils/formatters';

type ApiError = { error?: string };
type DividendPreviewAllocation = Pick<
  DividendMemberAllocation,
  'member_id' | 'member_full_name' | 'employee_id' | 'member_share_capital' | 'ownership_percent' | 'profit_share_estimated'
>;
type DividendPreview = {
  total_share_capital: number;
  total_cooperative_earnings: number;
  interest_rate: number;
  member_count: number;
  allocations: DividendPreviewAllocation[];
  generated_at: string;
};

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function statusBadge(status: DividendPeriodStatus) {
  const map: Record<DividendPeriodStatus, { variant: any; label: string }> = {
    pending: { variant: 'info', label: 'pending' },
    estimated_approved: { variant: 'success', label: 'estimated approved' },
    audit_pending: { variant: 'warning', label: 'audit pending' },
    audit_approved: { variant: 'success', label: 'audit approved' },
    final_locked: { variant: 'default', label: 'final locked' },
  };
  return map[status] ?? { variant: 'default', label: status };
}

export function DividendsPage() {
  const [periods, setPeriods] = useState<DividendPeriod[]>([]);
  const [allocations, setAllocations] = useState<DividendMemberAllocation[]>([]);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const [busyAction, setBusyAction] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<DividendPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  const isFinal = selectedPeriod?.status === 'final_locked';

  useEffect(() => {
    const fetchPeriods = async () => {
      setLoadingPeriods(true);
      setError('');
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY 
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/periods`, {
          headers,
        });
        const data = (await res.json()) as DividendPeriod[];
        if (!res.ok) throw new Error((data as ApiError)?.error ?? 'Failed to load periods');

        setPeriods(data || []);

        const first = (data || [])[0];
        if (first && !selectedPeriodId) setSelectedPeriodId(first.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load periods');
      } finally {
        setLoadingPeriods(false);
      }
    };

    void fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const [membersRes, loansRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members?status=active`, { headers }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans`, { headers }),
      ]);

      const members = membersRes.ok ? await membersRes.json() : [];
      const loans = loansRes.ok ? await loansRes.json() : [];

      if (!membersRes.ok) throw new Error('Failed to load active members for dividend preview');
      if (!loansRes.ok) throw new Error('Failed to load loans for dividend preview');

      const interestRate = 0.20;
      const totalShareCapital = members.reduce(
        (sum: number, member: any) => sum + safeNumber(member.share_capital_amount),
        0,
      );
      const totalCooperativeEarnings = loans
        .filter((loan: any) => loan.status === 'fully_paid')
        .reduce((sum: number, loan: any) => sum + safeNumber(loan.principal_amount) * interestRate, 0);

      const liveAllocations = members
        .map((member: any) => {
          const shareCapital = safeNumber(member.share_capital_amount);
          const ownership = totalShareCapital > 0 ? shareCapital / totalShareCapital : 0;

          return {
            member_id: member.id,
            employee_id: member.employee_id,
            member_full_name: member.full_name,
            member_share_capital: shareCapital,
            ownership_percent: ownership,
            profit_share_estimated: totalCooperativeEarnings * ownership,
          };
        })
        .sort((a: DividendPreviewAllocation, b: DividendPreviewAllocation) => {
          return safeNumber(b.member_share_capital) - safeNumber(a.member_share_capital);
        });

      setPreview({
        total_share_capital: totalShareCapital,
        total_cooperative_earnings: totalCooperativeEarnings,
        interest_rate: interestRate,
        member_count: liveAllocations.length,
        allocations: liveAllocations,
        generated_at: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live dividend preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    void fetchPreview();
    const timer = window.setInterval(() => {
      void fetchPreview();
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAllocations = async () => {
      if (!selectedPeriodId || selectedPeriodId === 'demo-uuid') return;
      setLoadingAllocations(true);
      setError('');
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY 
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/allocations?period_id=${encodeURIComponent(
            selectedPeriodId,
          )}`,
          { headers },
        );
        const data = (await res.json()) as DividendMemberAllocation[];
        if (!res.ok) throw new Error((data as ApiError)?.error ?? 'Failed to load allocations');

        setAllocations(data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load allocations');
      } finally {
        setLoadingAllocations(false);
      }
    };

    void fetchAllocations();
  }, [selectedPeriodId]);

  const handleCreatePeriod = async () => {
    setBusyAction('create');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/periods`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fiscal_year: new Date().getFullYear() })
      });
      if (res.ok) window.location.reload();
      else throw new Error('Failed to create period');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create period');
    } finally {
      setBusyAction('');
    }
  };

  const handleSeedDemoData = () => {
    const demoPeriod: DividendPeriod = {
      id: 'demo-uuid',
      fiscal_year: 2024,
      cutoff_date: new Date().toISOString(),
      status: 'pending',
      total_share_capital: 150000,
      total_cooperative_earnings: 45000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const demoAllocations: DividendMemberAllocation[] = [
      { id: '1', dividend_period_id: 'demo', member_id: 'm1', employee_id: 'EMO-001', member_full_name: 'Juan Dela Cruz', member_share_capital: 75000, ownership_percent: 0.5, profit_share_estimated: 22500, profit_share_final: 0 },
      { id: '2', dividend_period_id: 'demo', member_id: 'm2', employee_id: 'EMO-002', member_full_name: 'Maria Clara', member_share_capital: 45000, ownership_percent: 0.3, profit_share_estimated: 13500, profit_share_final: 0 },
      { id: '3', dividend_period_id: 'demo', member_id: 'm3', employee_id: 'EMO-003', member_full_name: 'Crisostomo Ibarra', member_share_capital: 30000, ownership_percent: 0.2, profit_share_estimated: 9000, profit_share_final: 0 }
    ];
    setPeriods([demoPeriod]);
    setSelectedPeriodId(demoPeriod.id);
    setAllocations(demoAllocations);
  };

  const runAction = async (action: 'compute-estimated' | 'submit-audit' | 'lock-final') => {
    if (!selectedPeriodId) return;

    setBusyAction(action);
    setError('');

    // Simulation for Demo Data to avoid 404/403 errors
    if (selectedPeriodId === 'demo-uuid') {
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
      if (action === 'compute-estimated') {
        const earnings = selectedPeriod?.total_cooperative_earnings || 45000;
        const totalCapital = selectedPeriod?.total_share_capital || 150000;
        setAllocations(prev => prev.map(a => ({
          ...a,
          profit_share_estimated: (a.member_share_capital / totalCapital) * earnings
        })));
      } else if (action === 'lock-final') {
        setPeriods(prev => prev.map(p => p.id === 'demo-uuid' ? { ...p, status: 'final_locked' as DividendPeriodStatus } : p));
        setAllocations(prev => prev.map(a => ({ ...a, profit_share_final: a.profit_share_estimated })));
      } else if (action === 'submit-audit') {
        setPeriods(prev => prev.map(p => p.id === 'demo-uuid' ? { ...p, status: 'audit_pending' as DividendPeriodStatus } : p));
      }
      setBusyAction('');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY 
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/periods/${encodeURIComponent(
          selectedPeriodId,
        )}/${action}`,
        {
          method: 'POST',
          headers,
        },
      );

      const body = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(body?.error ?? `Failed to ${action}`);

      // refresh
      const headers2 = headers;
      const periodsRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/periods`, {
        headers: headers2,
      });
      const periodsData = (await periodsRes.json()) as DividendPeriod[];
      setPeriods(periodsData || []);

      const allocRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/allocations?period_id=${encodeURIComponent(
          selectedPeriodId,
        )}`,
        { headers: headers2 },
      );
      const allocData = (await allocRes.json()) as DividendMemberAllocation[];
      setAllocations(allocData || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyAction('');
    }
  };

  const exportToExcel = () => {
    const out = allocations.map((r) => ({
      'Member': r.member_full_name,
      'Employee ID': r.employee_id,
      'Share Capital': safeNumber(r.member_share_capital),
      'Ownership %': (safeNumber(r.ownership_percent) * 100).toFixed(4) + '%',
      'Estimated Share': safeNumber(r.profit_share_estimated),
      'Final Share': safeNumber(r.profit_share_final)
    }));
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dividends');
    XLSX.writeFile(wb, `Dividends-${selectedPeriod?.fiscal_year || 'Report'}.xlsx`);
  };

  const exportToPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.text(`Dividend Allocation - Year ${selectedPeriod?.fiscal_year}`, 20, 30);
    
    const body = allocations.map((r) => [
      r.member_full_name,
      r.employee_id,
      formatCurrency(safeNumber(r.member_share_capital)),
      (safeNumber(r.ownership_percent) * 100).toFixed(2) + '%',
      formatCurrency(safeNumber(r.profit_share_estimated)),
      formatCurrency(safeNumber(r.profit_share_final))
    ]);

    autoTable(doc, {
      head: [['Member', 'ID', 'Share Capital', 'Ownership', 'Estimated', 'Final']],
      body,
      startY: 50,
      styles: { fontSize: 8 },
    });
    doc.save(`Dividends-${selectedPeriod?.fiscal_year}.pdf`);
  };

  const columns = useMemo(() => {
    const showFinal =
      selectedPeriod?.status === 'final_locked' || selectedPeriod?.status === 'audit_approved';

    const cols = [
      {
        key: 'member_full_name',
        header: 'Member',
        render: (row: DividendMemberAllocation) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.member_full_name}</p>
            <p className="text-sm text-gray-500">{row.employee_id}</p>
          </div>
        ),
      },
      {
        key: 'member_share_capital',
        header: 'Share Capital',
        render: (row: DividendMemberAllocation) => (
          <span className="font-medium">{formatCurrency(safeNumber(row.member_share_capital))}</span>
        ),
      },
      {
        key: 'ownership_percent',
        header: 'Ownership %',
        render: (row: DividendMemberAllocation) => (
          <span className="font-medium">{(safeNumber(row.ownership_percent) * 100).toFixed(2)}%</span>
        ),
      },
      {
        key: 'profit_share_estimated',
        header: 'Estimated Share',
        render: (row: DividendMemberAllocation) => (
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {formatCurrency(safeNumber(row.profit_share_estimated))}
          </span>
        ),
      },
    ];

    if (showFinal) {
      cols.push({
        key: 'profit_share_final',
        header: 'Final Share',
        render: (row: DividendMemberAllocation) => (
          <span className="font-medium text-green-600 dark:text-green-400">
            {formatCurrency(safeNumber(row.profit_share_final))}
          </span>
        ),
      });
    }

    return cols;
  }, [selectedPeriod?.status]);

  const shareTotal = useMemo(() => {
    if (!selectedPeriod) return 0;
    return safeNumber(selectedPeriod.total_share_capital);
  }, [selectedPeriod]);

  const finalizedPeriods = useMemo(
    () => periods.filter((p) => p.status === 'final_locked'),
    [periods],
  );

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Profit Sharing / Dividends"
        description="Estimated and final profit sharing computed using share capital only."
        actions={
          <div className="flex items-center gap-3">
            {periods.length === 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSeedDemoData}
                className="text-blue-600 hover:text-blue-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Seed Demo Data
              </Button>
            )}
            <Button
              onClick={handleCreatePeriod}
              loading={busyAction === 'create'}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Period
            </Button>
            <Button
              onClick={() => runAction('compute-estimated')}
              disabled={!selectedPeriod || busyAction !== ''}
              loading={busyAction === 'compute-estimated'}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Estimates
            </Button>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Shield className="w-4 h-4" />
              3rd-year audit gate: <span className="font-medium">{selectedPeriod?.status ? 'enforced' : '—'}</span>
            </div>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <Card padding="none" className="mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Live Pro-Rata Allocation Monitor</h2>
            <p className="text-sm text-gray-500">
              Based on active members' current share capital and cooperative earnings from fully paid loans.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => fetchPreview()}
            loading={loadingPreview}
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Live
          </Button>
        </div>

        <div className="p-6 space-y-4">
          {preview && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-300">Live Share Capital</p>
                  <p className="text-xl font-black text-blue-900 dark:text-blue-100">{formatCurrency(safeNumber(preview.total_share_capital))}</p>
                </div>
                <div className="p-4 rounded-lg border border-purple-100 dark:border-purple-900 bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-xs uppercase font-bold tracking-wider text-purple-600 dark:text-purple-300">Dividend Pool</p>
                  <p className="text-xl font-black text-purple-900 dark:text-purple-100">{formatCurrency(safeNumber(preview.total_cooperative_earnings))}</p>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    {(safeNumber(preview.interest_rate) * 100).toFixed(0)}% of fully paid loan principal
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-300">Members Included</p>
                  <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">{preview.member_count}</p>
                </div>
                <div className="p-4 rounded-lg border border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-xs uppercase font-bold tracking-wider text-amber-600 dark:text-amber-300">Live Return Rate</p>
                  <p className="text-xl font-black text-amber-900 dark:text-amber-100">
                    {preview.total_share_capital > 0
                      ? `${((preview.total_cooperative_earnings / preview.total_share_capital) * 100).toFixed(2)}%`
                      : '0.00%'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Member</th>
                      <th className="text-right px-4 py-3 font-semibold">Share Capital</th>
                      <th className="text-right px-4 py-3 font-semibold">Pro-Rata %</th>
                      <th className="text-right px-4 py-3 font-semibold">Live Allocation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {preview.allocations.map((row) => (
                      <tr key={row.member_id} className="bg-white dark:bg-gray-950">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{row.member_full_name}</p>
                          <p className="text-xs text-gray-500">{row.employee_id}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(safeNumber(row.member_share_capital))}</td>
                        <td className="px-4 py-3 text-right">{(safeNumber(row.ownership_percent) * 100).toFixed(4)}%</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(safeNumber(row.profit_share_estimated))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500">
                Last updated: {preview.generated_at ? formatDate(preview.generated_at) : 'just now'}
              </p>
            </>
          )}

          {!preview && (
            <div className="text-sm text-gray-500">
              {loadingPreview ? 'Loading live allocation preview...' : 'No live allocation preview available.'}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card padding="none" className="lg:col-span-1">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dividend Periods</h2>
          </div>
          <div className="p-4 space-y-3">
            {loadingPeriods ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : periods.length === 0 ? (
              <div className="text-sm text-gray-500">No dividend periods found.</div>
            ) : (
              <div className="space-y-2">
                {periods.map((p) => {
                  const active = p.id === selectedPeriodId;
                  const b = statusBadge(p.status as DividendPeriodStatus);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPeriodId(p.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Year {p.fiscal_year}</p>
                          <p className="text-sm text-gray-500">{p.cutoff_date ? formatDate(p.cutoff_date) : '—'}</p>
                        </div>
                        <Badge variant={b.variant}>{b.label}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2" padding="none">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Allocation Details</h2>
              <p className="text-sm text-gray-500">
                {selectedPeriod ? (
                  <>Share capital: <span className="font-medium">{formatCurrency(shareTotal)}</span> | Earnings: <span className="font-medium text-purple-600">{formatCurrency(safeNumber(selectedPeriod.total_cooperative_earnings))}</span></>
                ) : 'Select a period to view allocations.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => runAction('submit-audit')}
                disabled={!selectedPeriod || busyAction !== '' || isFinal}
                loading={busyAction === 'submit-audit'}
                variant="secondary"
              >
                <Shield className="w-4 h-4 mr-2" />
                Submit Audit
              </Button>

              <Button
                onClick={() => runAction('lock-final')}
                disabled={!selectedPeriod || busyAction !== '' || isFinal}
                loading={busyAction === 'lock-final'}
              >
                {isFinal ? (
                  <Lock className="w-4 h-4 mr-2" />
                ) : (
                  <Unlock className="w-4 h-4 mr-2" />
                )}
                Lock Final
              </Button>
              
              <div className="h-8 w-px bg-gray-200 dark:bg-gray-800 mx-2" />
              
              <Button variant="secondary" onClick={exportToPdf} disabled={allocations.length === 0}>
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="secondary" onClick={exportToExcel} disabled={allocations.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Excel
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {selectedPeriod && allocations.length > 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-2 -bottom-2 text-blue-200/50 dark:text-blue-700/30 group-hover:scale-110 transition-transform">
                      <Wallet className="w-16 h-16" />
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">Total Share Capital</p>
                    <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">{formatCurrency(shareTotal)}</p>
                  </div>

                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-2 -bottom-2 text-purple-200/50 dark:text-purple-700/30 group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-16 h-16" />
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 uppercase font-bold tracking-wider">Total Earnings</p>
                    <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-1">
                      {formatCurrency(allocations.reduce((sum, a) => sum + safeNumber(a.profit_share_estimated), 0))}
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-2 -bottom-2 text-green-200/50 dark:text-green-700/30 group-hover:scale-110 transition-transform">
                      <Users className="w-16 h-16" />
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 uppercase font-bold tracking-wider">Active Members</p>
                    <p className="text-2xl font-black text-green-700 dark:text-green-300 mt-1">{allocations.length}</p>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-2 -bottom-2 text-amber-200/50 dark:text-amber-700/30 group-hover:scale-110 transition-transform">
                      <PieChart className="w-16 h-16" />
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 uppercase font-bold tracking-wider">System Status</p>
                    <div className="mt-2 font-black text-amber-700 dark:text-amber-300 uppercase tracking-tighter">
                      {selectedPeriod.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                {/* "Graph" Simulation: Visual Distribution Bar */}
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Earnings-to-Capital Ratio</span>
                    <span className="text-xs font-bold text-blue-600">{( (allocations.reduce((sum, a) => sum + safeNumber(a.profit_share_estimated), 0) / shareTotal) * 100 ).toFixed(2)}% Return</span>
                  </div>
                  <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-blue-500" style={{ width: '70%' }}></div>
                    <div className="h-full bg-purple-500 animate-pulse" style={{ width: '30%' }}></div>
                  </div>
                </div>
              </div>
            )}

            {loadingAllocations ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : allocations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No allocations found for this period.</div>
            ) : (
              <Table
                columns={columns as any}
                data={allocations as any}
                keyExtractor={(r: any) => r.id}

                loading={loadingAllocations}
                emptyMessage="No allocations found"
              />
            )}
          </div>
        </Card>
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historical Dividend Records</h2>
          <p className="text-sm text-gray-500">Final locked periods with recorded distributions.</p>
        </div>
        <div className="p-6">
          {finalizedPeriods.length === 0 ? (
            <div className="text-sm text-gray-500">No finalized dividend periods yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finalizedPeriods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPeriodId(p.id)}
                  className="text-left p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Year {p.fiscal_year}</p>
                      <p className="text-sm text-gray-500">{p.cutoff_date ? formatDate(p.cutoff_date) : '—'}</p>
                    </div>
                    <Badge variant="default">final locked</Badge>
                  </div>
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                    Total cooperative earnings snapshot:{' '}
                    <span className="font-medium">
                      {formatCurrency(safeNumber(p.total_cooperative_earnings))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
