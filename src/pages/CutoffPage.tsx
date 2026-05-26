import { useEffect, useState } from 'react';
import { Calendar, DollarSign, CheckCircle, XCircle, Play, Pause } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Badge, Modal } from '../components/common/DataCard';
import { StatCard } from '../components/common/StatCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { CutoffSummaryView } from '../types/database';

interface CutoffDetails extends CutoffSummaryView {
  loans?: Array<{
    id: string;
    loan_id: string;
    member: { full_name: string; employee_id: string };
    principal_amount: number;
    status: string;
  }>;
}

const formatLabel = (value?: string | null) => value?.replace(/_/g, ' ') || 'Unknown';

export function CutoffPage() {
  const [cutoffs, setCutoffs] = useState<CutoffDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCutoff, setSelectedCutoff] = useState<CutoffDetails | null>(null);

  useEffect(() => {
    fetchCutoffs();
  }, []);

  const fetchCutoffs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cutoffs`,
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
    } finally {
      setLoading(false);
    }
  };

  const fetchCutoffDetails = async (cutoffId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cutoffs/${cutoffId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedCutoff(data);
      }
    } catch (error) {
      console.error('Error fetching cutoff details:', error);
    }
  };

  const toggleCutoffStatus = async (cutoffId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cutoffs/${cutoffId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response.ok) {
        fetchCutoffs();
        if (selectedCutoff?.id === cutoffId) {
          fetchCutoffDetails(cutoffId);
        }
      }
    } catch (error) {
      console.error('Error updating cutoff:', error);
    }
  };

  const openCutoffs = cutoffs.filter(c => c.status === 'open');
  const closedCutoffs = cutoffs.filter(c => c.status === 'closed');

  const statusConfig = {
    open: { variant: 'success' as const, icon: CheckCircle, color: 'green' },
    closed: { variant: 'default' as const, icon: XCircle, color: 'gray' },
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Cutoff Management"
        description="Manage lending cutoff periods and track collections"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Cutoffs"
          value={cutoffs.length}
          icon={<Calendar className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Open Cutoffs"
          value={openCutoffs.length}
          icon={<Play className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Closed Cutoffs"
          value={closedCutoffs.length}
          icon={<Pause className="w-6 h-6" />}
          color="gray"
        />
        <StatCard
          title="Total Released"
          value={formatCurrency(cutoffs.reduce((sum, c) => sum + (c.total_released || 0), 0))}
          icon={<DollarSign className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Cutoff List */}
      <div className="space-y-6">
        {/* Open Cutoffs */}
        {openCutoffs.length > 0 && (
          <Card>
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-green-500" />
                Open Cutoff Periods
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {openCutoffs.map((cutoff) => {
                const config = statusConfig[cutoff.status];
                const capacityUsed = ((cutoff.total_released || 0) / cutoff.max_lending) * 100;

                return (
                  <div
                    key={cutoff.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => fetchCutoffDetails(cutoff.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${config.color}-100 dark:bg-${config.color}-900/30`}>
                          <config.icon className={`w-6 h-6 text-${config.color}-600`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatDate(cutoff.cutoff_date)}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {formatLabel(cutoff.cutoff_type)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(cutoff.total_released || 0)}
                        </p>
                        <p className="text-sm text-gray-500">
                          of {formatCurrency(cutoff.max_lending)}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-500">
                          {cutoff.borrower_count} borrower{cutoff.borrower_count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-500">
                          {capacityUsed.toFixed(1)}% utilized
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${capacityUsed >= 90 ? 'bg-red-500' : capacityUsed >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(capacityUsed, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex justify-between items-center">
                      <Badge variant={config.variant}>
                        {cutoff.status}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCutoffStatus(cutoff.id, cutoff.status);
                        }}
                      >
                        Close Cutoff
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Closed Cutoffs */}
        {closedCutoffs.length > 0 && (
          <Card>
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Pause className="w-5 h-5 text-gray-500" />
                Closed Cutoff Periods
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {closedCutoffs.slice(0, 5).map((cutoff) => {
                const config = statusConfig[cutoff.status];

                return (
                  <div
                    key={cutoff.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer opacity-75"
                    onClick={() => fetchCutoffDetails(cutoff.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                          <config.icon className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatDate(cutoff.cutoff_date)}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {formatLabel(cutoff.cutoff_type)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(cutoff.total_released || 0)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {cutoff.borrower_count} borrower{cutoff.borrower_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {cutoffs.length === 0 && !loading && (
          <Card className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Cutoff Periods
            </h3>
            <p className="text-gray-500">
              Cutoff periods will be created automatically when loans are released.
            </p>
          </Card>
        )}
      </div>

      {/* Cutoff Details Modal */}
      {selectedCutoff && (
        <CutoffDetailsModal
          cutoff={selectedCutoff}
          onClose={() => setSelectedCutoff(null)}
          onToggleStatus={() => toggleCutoffStatus(selectedCutoff.id, selectedCutoff.status)}
        />
      )}
    </div>
  );
}

function CutoffDetailsModal({
  cutoff,
  onClose,
  onToggleStatus,
}: {
  cutoff: CutoffDetails;
  onClose: () => void;
  onToggleStatus: () => void;
}) {
  const [loans, setLoans] = useState<Array<{
    id: string;
    loan_id: string;
    member: { full_name: string; employee_id: string };
    principal_amount: number;
    total_payable: number;
    remaining_balance: number;
    status: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoans();
  }, [cutoff.id]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans?cutoff_id=${cutoff.id}`,
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

  const collections = loans.reduce((sum, l) => sum + (l.total_payable - l.remaining_balance), 0);
  const outstanding = loans.reduce((sum, l) => sum + l.remaining_balance, 0);

  return (
    <Modal isOpen={true} onClose={onClose} title={`Cutoff Period - ${formatDate(cutoff.cutoff_date)}`} size="xl">
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 capitalize">{formatLabel(cutoff.cutoff_type)}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDate(cutoff.cutoff_date)}
            </p>
          </div>
          <Badge variant={cutoff.status === 'open' ? 'success' : 'default'}>
            {cutoff.status}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <DollarSign className="w-5 h-5 text-blue-600 mb-1" />
            <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {formatCurrency(cutoff.max_lending)}
            </p>
            <p className="text-xs text-blue-600">Max Lending</p>
          </Card>
          <Card className="bg-green-50 dark:bg-green-900/20">
            <DollarSign className="w-5 h-5 text-green-600 mb-1" />
            <p className="text-xl font-bold text-green-900 dark:text-green-100">
              {formatCurrency(cutoff.total_released || 0)}
            </p>
            <p className="text-xs text-green-600">Released</p>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/20">
            <DollarSign className="w-5 h-5 text-purple-600 mb-1" />
            <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
              {formatCurrency(collections)}
            </p>
            <p className="text-xs text-purple-600">Collected</p>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/20">
            <DollarSign className="w-5 h-5 text-amber-600 mb-1" />
            <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
              {formatCurrency(outstanding)}
            </p>
            <p className="text-xs text-amber-600">Outstanding</p>
          </Card>
        </div>

        {/* Borrowers Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Borrowers ({loans.length})
            </h3>
            <p className="text-sm text-gray-500">
              {loans.filter(l => l.status === 'delayed').length} delayed
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : loans.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No loans in this cutoff period</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {loans.map((loan) => (
                <div
                  key={loan.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-mono text-sm text-blue-600">{loan.loan_id}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {loan.member?.full_name}
                    </p>
                    <p className="text-xs text-gray-500">{loan.member?.employee_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(loan.principal_amount)}</p>
                    <Badge
                      variant={
                        loan.status === 'active' ? 'success' :
                        loan.status === 'delayed' ? 'warning' : 'info'
                      }
                      className="text-xs mt-1"
                    >
                      {formatLabel(loan.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {cutoff.status === 'open' && (
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onToggleStatus}>
              <Pause className="w-4 h-4 mr-2" />
              Close Cutoff Period
            </Button>
          </div>
        )}

        {cutoff.status === 'closed' && (
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onToggleStatus}>
              <Play className="w-4 h-4 mr-2" />
              Reopen Cutoff Period
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
