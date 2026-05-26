import { useEffect, useState } from 'react';
import { Plus, Search, Building2 } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Badge, Modal, Input, Select } from '../components/common/DataCard';
import { StatCard } from '../components/common/StatCard';
import type { ShareCapital, MemberSummaryView } from '../types/database';
import { formatCurrency, formatDate } from '../utils/formatters';

export function ShareCapitalPage() {
  const [shareCapitals, setShareCapitals] = useState<ShareCapital[]>([]);
  const [members, setMembers] = useState<MemberSummaryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchShareCapitals();
    fetchMembers();
  }, []);

  const fetchShareCapitals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shares`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setShareCapitals(data || []);
      }
    } catch (error) {
      console.error('Error fetching share capitals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members?status=active`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMembers(data || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const totalShareCapital = shareCapitals.reduce((sum, sc) => sum + sc.amount, 0);
  const membersWithShareCapital = members.filter(m => m.share_capital_amount > 0).length;
  const membersWithoutShareCapital = members.filter(m => m.share_capital_amount === 0).length;

  const filteredShareCapitals = searchQuery
    ? shareCapitals.filter(
        (sc) =>
          sc.member?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sc.member?.employee_id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shareCapitals;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Share Capital"
        description="Manage member share capital contributions"
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Contribution
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Share Capital"
          value={formatCurrency(totalShareCapital)}
          icon={<Building2 className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Contributors"
          value={membersWithShareCapital}
          subtitle="Members with share capital"
          color="green"
        />
        <StatCard
          title="Pending Contributions"
          value={membersWithoutShareCapital}
          subtitle="Members without share capital"
          color="yellow"
        />
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by member name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredShareCapitals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No share capital records found
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredShareCapitals.map((sc) => (
              <div
                key={sc.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {sc.member?.full_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">{sc.member?.employee_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(sc.amount)}
                  </p>
                  <p className="text-sm text-gray-500">{formatDate(sc.payment_date)}</p>
                  {sc.receipt_number && (
                    <p className="text-xs text-gray-400">{sc.receipt_number}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddModal && (
        <AddShareCapitalModal
          members={members.filter(m => m.share_capital_amount === 0)}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchShareCapitals();
            fetchMembers();
          }}
        />
      )}
    </div>
  );
}

function AddShareCapitalModal({
  members,
  onClose,
  onSuccess,
}: {
  members: MemberSummaryView[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shares`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            member_id: memberId,
            amount: Number(amount),
            payment_date: paymentDate,
            notes: notes || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record share capital');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Record Share Capital Contribution" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-sm">
            {error}
          </div>
        )}

        <Select
          label="Member"
          value={memberId}
          onChange={setMemberId}
          options={members.map((m) => ({
            value: m.id,
            label: `${m.full_name} (${m.employee_id})`,
          }))}
          placeholder="Select a member"
          required
        />

        <Input
          label="Amount (PHP)"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="Enter amount"
          required
        />

        <Input
          label="Payment Date"
          type="date"
          value={paymentDate}
          onChange={setPaymentDate}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Any additional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Record Contribution
          </Button>
        </div>
      </form>
    </Modal>
  );
}
