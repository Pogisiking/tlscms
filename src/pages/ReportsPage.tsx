import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Building2,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Search,
  Printer,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Input, Select } from '../components/common/DataCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import { safeNumber } from '../utils/reporting';

type ReportId =
  | 'share-capital'
  | 'loan-release'
  | 'collections'
  | 'active-loans'
  | 'fully-paid'
  | 'missed-payments'
  | 'member-loan-history'
  | 'kinsenas-summary'
  | 'cash-flow';

type SortDir = 'asc' | 'desc';

type ReportType = {
  id: ReportId;
  name: string;
  description: string;
  icon: any;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'gray';
};

const reportTypes: ReportType[] = [
  {
    id: 'share-capital',
    name: 'Share Capital Report',
    description: 'Per member contribution',
    icon: Building2,
    color: 'blue',
  },
  {
    id: 'loan-release',
    name: 'Loan Release Report',
    description: 'All released loans',
    icon: DollarSign,
    color: 'green',
  },
  {
    id: 'collections',
    name: 'Collection Report',
    description: 'All received payments',
    icon: Calendar,
    color: 'blue',
  },
  {
    id: 'active-loans',
    name: 'Active Loan Report',
    description: 'All active loans',
    icon: DollarSign,
    color: 'green',
  },
  {
    id: 'fully-paid',
    name: 'Fully Paid Loan Report',
    description: 'All fully paid loans',
    icon: TrendingUp,
    color: 'purple',
  },
  {
    id: 'missed-payments',
    name: 'Missed Payment Report',
    description: 'Loans with missed payments',
    icon: AlertTriangle,
    color: 'yellow',
  },
  {
    id: 'member-loan-history',
    name: 'Member Loan History Report',
    description: 'Detailed history per member',
    icon: AlertTriangle,
    color: 'gray',
  },
  {
    id: 'kinsenas-summary',
    name: 'Kinsenas Summary Report',
    description: 'Collection summary per cutoff',
    icon: Calendar,
    color: 'gray',
  },
  {
    id: 'cash-flow',
    name: 'Cash Flow Report',
    description: 'Collections vs Releases',
    icon: DollarSign,
    color: 'gray',
  },
];

const colorStyles: Record<ReportType['color'], string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 shadow-blue-500/5',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 shadow-emerald-500/5',
  yellow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-amber-500/5',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 shadow-purple-500/5',
  gray: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 shadow-slate-500/5',
};

function buildReportUrl(reportId: ReportId, params?: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') sp.set(k, v);
    }
  }
  const query = sp.toString();
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reports/${reportId}`;
  return query ? `${base}?${query}` : base;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

export function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportId>('share-capital');

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [memberId, setMemberId] = useState<string>('');
  const [beginningCash, setBeginningCash] = useState<string>('0');

  // Table controls
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const reportMeta = useMemo(() => reportTypes.find((r) => r.id === activeReport)!, [activeReport]);

  useEffect(() => {
    setPage(1);
  }, [activeReport, startDate, endDate, memberId, beginningCash, pageSize, debouncedSearch, sortKey, sortDir]);

  // Fetch members list for the selection dropdown
  useEffect(() => {
    const fetchMembersList = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members?status=active`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
          },
        });
        if (res.ok) {
          const json = await res.json();
          setMembers(json || []);
        }
      } catch (e) {
        console.error('Failed to fetch members for reports:', e);
      }
    };
    fetchMembersList();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!token) {
        setData([]);
        return;
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'apikey': apiKey,
      };

      const query: Record<string, string | undefined> = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      if (activeReport === 'cash-flow') {
        const collectionsUrl = buildReportUrl('collections', query);
        const loansReleasedUrl = buildReportUrl('active-loans', query);

        const [collectionsRes, loansRes] = await Promise.all([
          fetch(collectionsUrl, { headers }),
          fetch(loansReleasedUrl, { headers }),
        ]);

        const [collectionsJson, loansJson] = await Promise.all([
          collectionsRes.ok ? collectionsRes.json() : [],
          loansRes.ok ? loansRes.json() : [],
        ]);

        const collections = Array.isArray(collectionsJson) ? collectionsJson : [];
        const releasedLoans = Array.isArray(loansJson) ? loansJson : [];

        const collectionsTotal = collections.reduce((sum: number, p: any) => sum + safeNumber(p?.amount), 0);
        const releasedTotal = releasedLoans.reduce((sum: number, l: any) => sum + safeNumber(l?.principal_amount), 0);
        const beginning = safeNumber(beginningCash, 0);

        setData([{
          beginning_cash: beginning,
          collections: collectionsTotal,
          loans_released: releasedTotal,
          cash_on_hand: beginning + collectionsTotal - releasedTotal,
        }]);
        return;
      }

      if (activeReport === 'member-loan-history') {
        if (!memberId) {
          setData([]);
          return;
        }
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reports/member/${memberId}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to fetch loan history');
        const json = await res.json();
        setData(Array.isArray(json) ? json : json?.data || []);
        return;
      }

      if (activeReport === 'loan-release') {
        // The reports/loan-release endpoint might be missing (404). 
        // Use the primary loans endpoint and filter for released loans.
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const json = await res.json();
        const loans = Array.isArray(json) ? json : json?.data || [];
        // Filter for loans that are released (active, delayed, fully_paid, closed)
        const released = loans.filter((l: any) => {
          if (l.status === 'pending') return false;
          if (startDate && l.release_date < startDate) return false;
          if (endDate && l.release_date > endDate) return false;
          return true;
        });
        setData(released);
        return;
      }

      if (activeReport === 'kinsenas-summary') {
        // The reports/kinsenas-summary endpoint is unreliable; use the primary cutoffs endpoint instead
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cutoffs`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const json = await res.json();
        setData(Array.isArray(json) ? json : json?.data || []);
        return;
      }

      const url = buildReportUrl(activeReport as ReportId, query);
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : json?.data || []);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeReport === 'member-loan-history' && !memberId) {
      setData([]);
      return;
    }
    fetchReport();
  }, [activeReport, startDate, endDate, memberId, beginningCash]);

  const filteredAndSorted = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let rows = data;
    if (q) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a?.[sortKey];
        const bv = b?.[sortKey];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      });
    }
    return rows;
  }, [data, debouncedSearch, sortKey, sortDir]);

  const totalRows = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageRows = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  const tableColumns = useMemo<Column<any>[]>(() => {
    switch (activeReport) {
      case 'share-capital':
        return [
          { key: 'employee_id', header: 'Employee ID' },
          { key: 'full_name', header: 'Member', render: (r) => r?.member?.full_name ?? r?.member_full_name ?? '' },
          { key: 'amount', header: 'Contribution', render: (r) => formatCurrency(safeNumber(r?.amount)) },
          { key: 'payment_date', header: 'Date', render: (r) => formatDate(r?.payment_date) },
        ];
      case 'loan-release':
        return [
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member_name', header: 'Member', render: (r) => r?.member_name ?? r?.member?.full_name ?? 'Unknown' },
          { key: 'principal_amount', header: 'Principal', render: (r) => formatCurrency(safeNumber(r?.principal_amount)) },
          { key: 'release_date', header: 'Release Date', render: (r) => formatDate(r?.release_date) },
        ];
      case 'active-loans':
        return [
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member_name', header: 'Member', render: (r) => r?.member_name ?? r?.member?.full_name ?? 'Unknown' },
          { key: 'principal_amount', header: 'Principal', render: (r) => formatCurrency(safeNumber(r?.principal_amount)) },
          { key: 'remaining_balance', header: 'Balance', render: (r) => formatCurrency(safeNumber(r?.remaining_balance)) },
          { key: 'next_due_date', header: 'Next Due', render: (r) => formatDate(r?.next_due_date) },
        ];
      case 'fully-paid':
        return [
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member', header: 'Member', render: (r) => r?.member?.full_name ?? r?.member_name ?? 'Unknown' },
          { key: 'principal_amount', header: 'Principal', render: (r) => formatCurrency(safeNumber(r?.principal_amount)) },
          { key: 'release_date', header: 'Release Date', render: (r) => formatDate(r?.release_date) },
          { key: 'status', header: 'Status', render: () => <span className="text-green-600 font-medium">Fully Paid</span> },
        ];
      case 'collections':
        return [
          { key: 'payment_date', header: 'Date', render: (r) => formatDate(r?.payment_date) },
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member', header: 'Member', render: (r) => r?.loan?.member?.full_name ?? r?.member_name ?? r?.member?.full_name ?? 'Unknown' },
          { key: 'amount', header: 'Amount', render: (r) => formatCurrency(safeNumber(r?.amount)) },
        ];
      case 'missed-payments':
        return [
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member', header: 'Member', render: (r) => r?.member?.full_name ?? r?.member_name ?? 'Unknown' },
          { key: 'missed_payment_count', header: 'Missed', render: (r) => safeNumber(r?.missed_payment_count) },
          { key: 'installment_amount', header: 'Installment', render: (r) => formatCurrency(safeNumber(r?.installment_amount)) },
          { key: 'next_due_date', header: 'Next Due', render: (r) => formatDate(r?.next_due_date) },
        ];
      case 'member-loan-history':
        return [
          { key: 'member', header: 'Member', render: (r) => r?.member?.full_name ?? members.find(m => m.id === memberId)?.full_name ?? '' },
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'principal_amount', header: 'Principal', render: (r) => formatCurrency(safeNumber(r?.principal_amount)) },
          { key: 'remaining_balance', header: 'Remaining', render: (r) => formatCurrency(safeNumber(r?.remaining_balance)) },
          { key: 'status', header: 'Status', render: (r) => <span className="capitalize">{r?.status?.replace('_', ' ')}</span> },
          { key: 'release_date', header: 'Released', render: (r) => formatDate(r?.release_date) },
        ];
      case 'kinsenas-summary':
        return [
          { key: 'cutoff_date', header: 'Cutoff Date', render: (r) => formatDate(r?.cutoff_date) },
          { key: 'total_released', header: 'Total Released', render: (r) => formatCurrency(safeNumber(r?.total_released)) },
          { key: 'borrower_count', header: 'Borrowers' },
          { key: 'status', header: 'Status', render: (r) => <span className="capitalize">{r?.status}</span> },
        ];
      case 'cash-flow':
        return [
          { key: 'beginning_cash', header: 'Beginning', render: (r) => formatCurrency(safeNumber(r?.beginning_cash)) },
          { key: 'collections', header: 'Collections', render: (r) => formatCurrency(safeNumber(r?.collections)) },
          { key: 'loans_released', header: 'Releases', render: (r) => formatCurrency(safeNumber(r?.loans_released)) },
          { key: 'cash_on_hand', header: 'Cash on Hand', render: (r) => formatCurrency(safeNumber(r?.cash_on_hand)) },
        ];
      default:
        return [];
    }
  }, [activeReport]);

  const exportToExcel = () => {
    const out = filteredAndSorted.map((r) => {
      const obj: Record<string, any> = {};
      tableColumns.forEach((c) => {
        const val = c.render ? c.render(r) : r?.[c.key];
        obj[c.header] = val;
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${activeReport}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.text(reportMeta.name, 20, 30);
    const body = filteredAndSorted.map((r) => tableColumns.map((c) => {
      const v = c.render ? c.render(r) : r?.[c.key];
      return String(v ?? '');
    }));
    autoTable(doc, {
      head: [tableColumns.map((c) => c.header)],
      body,
      startY: 50,
      styles: { fontSize: 8 },
    });
    doc.save(`${activeReport}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Reports" description="Create printable and exportable audit reports" />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            onClick={() => setActiveReport(report.id)}
              className={`cursor-pointer transition-all duration-300 ${activeReport === report.id ? 'scale-[1.03] -translate-y-1' : 'hover:scale-[1.01]'}`}
          >
              <Card className={`border-2 transition-all ${activeReport === report.id ? 'border-blue-500 shadow-xl shadow-blue-500/10' : 'border-transparent'}`}>
                <div className="flex items-start gap-4 p-1">
                  <div className={`p-4 rounded-2xl border ${colorStyles[report.color]}`}>
                  <report.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{report.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{reportMeta.name}</p>
                <p className="text-sm text-gray-500">{reportMeta.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={exportToPdf} disabled={loading}><Download className="w-4 h-4 mr-2" />PDF</Button>
                <Button variant="secondary" onClick={exportToExcel} disabled={loading}><Download className="w-4 h-4 mr-2" />Excel</Button>
                <Button variant="ghost" onClick={() => window.print()} disabled={loading}><Printer className="w-4 h-4 mr-2" />Print</Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input label="Start Date" type="date" value={startDate} onChange={setStartDate} />
              <Input label="End Date" type="date" value={endDate} onChange={setEndDate} />
              {activeReport === 'member-loan-history' && (
                <Select
                  label="Select Member"
                  value={memberId}
                  onChange={setMemberId}
                  options={[
                    { value: '', label: 'Choose a member...' },
                    ...members.map(m => ({ value: m.id, label: m.full_name }))
                  ]}
                />
              )}
              {activeReport === 'cash-flow' && (
                <Input label="Beginning Cash" value={beginningCash} onChange={setBeginningCash} />
              )}
            </div>
            
            <div className="mt-4 flex gap-3">
              <div className="flex-1">
                <Input label="Search results" value={search} onChange={setSearch} placeholder="Filter table content..." />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {tableColumns.map((c) => (
                    <th key={c.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {loading ? (
                  <tr><td colSpan={tableColumns.length} className="text-center py-12">Loading report data...</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={tableColumns.length} className="text-center py-12">No records found</td></tr>
                ) : (
                  pageRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      {tableColumns.map((c) => (
                        <td key={c.key} className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                          {c.render ? c.render(row) : String(row?.[c.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} ({totalRows} records)</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Prev</Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Next</Button>
            </div>
          </div>
        </Card>
      </div>
      <style>{'@media print { .no-print { display: none !important; } }'}</style>
    </div>
  );
}
