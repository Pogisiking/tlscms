import { useEffect, useState } from 'react';
import { Plus, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Badge, Table } from '../components/common/DataCard';
import { StatCard } from '../components/common/StatCard';
import type { Loan, CutoffSummaryView } from '../types/database';
import { formatCurrency, formatDate } from '../utils/formatters';
import { LoanDetailsModal } from '../components/loans/LoanDetailsModal';
import { NewLoanModal } from '../components/loans/NewLoanModal';

const isConfigEnabled = (value: unknown) => value !== false && value !== 'false';

export function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [cutoffs, setCutoffs] = useState<CutoffSummaryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [enforceCutoffRules, setEnforceCutoffRules] = useState(true);

  useEffect(() => {
    fetchLoans();
    fetchCutoffs();
  }, [statusFilter]);

  useEffect(() => {
    fetchCutoffRuleConfig();
  }, []);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLoans(data || []);
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCutoffs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/cutoffs`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCutoffs(data || []);
      }
    } catch (error) {
      console.error('Error fetching cutoffs:', error);
    }
  };

  const fetchCutoffRuleConfig = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/config/key/enforce_cutoff_rules`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEnforceCutoffRules(isConfigEnabled(data.config_value));
      }
    } catch (error) {
      console.error('Error fetching cutoff rule config:', error);
    }
  };

  const activeCutoff = cutoffs.find((c) => c.status === 'open');
  const canCreateLoan = Boolean(activeCutoff) || !enforceCutoffRules;

  const stats = {
    total: loans.length,
    active: loans.filter((l) => l.status === 'active').length,
    delayed: loans.filter((l) => l.status === 'delayed').length,
    fullyPaid: loans.filter((l) => l.status === 'fully_paid').length,
  };

  const columns = [
    {
      key: 'loan_id',
      header: 'Loan ID',
      render: (loan: Loan) => (
        <span className="font-mono text-sm font-medium text-blue-600">{loan.loan_id}</span>
      ),
    },
    {
      key: 'member',
      header: 'Borrower',
      render: (loan: Loan) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {loan.member?.full_name || 'Unknown'}
          </p>
          <p className="text-sm text-gray-500">{loan.member?.employee_id || ''}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (loan: Loan) => (
        <div>
          <p className="font-medium">{formatCurrency(loan.principal_amount)}</p>
          <p className="text-sm text-gray-500">Payable: {formatCurrency(loan.total_payable)}</p>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (loan: Loan) => (
        <div>
          <p className="font-medium">
            {loan.payments_made}/{loan.total_installments}
          </p>
          <p className="text-sm text-gray-500">{formatCurrency(loan.remaining_balance)} left</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (loan: Loan) => {
        const statusConfig = {
          pending: { variant: 'info' as const, icon: Clock },
          active: { variant: 'success' as const, icon: CheckCircle2 },
          delayed: { variant: 'warning' as const, icon: AlertCircle },
          fully_paid: { variant: 'default' as const, icon: CheckCircle2 },
          closed: { variant: 'default' as const, icon: XCircle },
        };
        const config = statusConfig[loan.status] || statusConfig.pending;
        const Icon = config.icon;

        return (
          <Badge variant={config.variant} className="flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {loan.status.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      key: 'release_date',
      header: 'Released',
      render: (loan: Loan) => (
        <span className="text-sm text-gray-500">{formatDate(loan.release_date)}</span>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Loans"
        description="Manage lending operations and loan tracking"
        actions={
          <Button onClick={() => setShowNewLoanModal(true)} disabled={!canCreateLoan}>
            <Plus className="w-4 h-4 mr-2" />
            New Loan
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Loans" value={stats.total} color="gray" />
        <StatCard title="Active" value={stats.active} color="blue" />
        <StatCard title="Delayed" value={stats.delayed} color="yellow" />
        <StatCard title="Fully Paid" value={stats.fullyPaid} color="green" />
      </div>

      {/* Current Cutoff Info */}
      {activeCutoff && (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                Active Cutoff Period
              </p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {formatDate(activeCutoff.cutoff_date)} - {activeCutoff.cutoff_type.replace('_', ' ')}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                {formatCurrency(activeCutoff.remaining_capacity)} capacity remaining
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {activeCutoff.borrower_count}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">Borrowers</p>
            </div>
          </div>
        </Card>
      )}

      {!activeCutoff && enforceCutoffRules && (
        <Card className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800 dark:text-yellow-200">
              No active cutoff period. Loans cannot be processed at this time.
            </p>
          </div>
        </Card>
      )}

      {!activeCutoff && !enforceCutoffRules && (
        <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <p className="text-blue-800 dark:text-blue-200">
              Cutoff rule enforcement is off. Loans can be processed for the selected release date.
            </p>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="delayed">Delayed</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <Table
          columns={columns}
          data={loans}
          keyExtractor={(loan) => loan.id}
          loading={loading}
          emptyMessage="No loans found"
          onRowClick={(loan) => setSelectedLoan(loan)}
        />
      </Card>

      {showNewLoanModal && (
        <NewLoanModal
          cutoff={enforceCutoffRules ? activeCutoff : undefined}
          enforceCutoffRules={enforceCutoffRules}
          onClose={() => setShowNewLoanModal(false)}
          onSuccess={() => {
            setShowNewLoanModal(false);
            fetchLoans();
            fetchCutoffs();
          }}
        />
      )}

      {selectedLoan && (
        <LoanDetailsModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onUpdate={fetchLoans}
        />
      )}
    </div>
  );
}
