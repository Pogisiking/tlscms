import { useState, useEffect } from 'react';
import { Button, Input, Select, Modal } from '../common/DataCard';
import { Search, AlertCircle } from 'lucide-react';
import type { MemberSummaryView, CutoffSummaryView } from '../../types/database';
import { formatCurrency } from '../../utils/formatters';

interface NewLoanModalProps {
  cutoff?: CutoffSummaryView;
  enforceCutoffRules?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewLoanModal({ cutoff, enforceCutoffRules = true, onClose, onSuccess }: NewLoanModalProps) {
  const [members, setMembers] = useState<MemberSummaryView[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberSummaryView[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberSummaryView | null>(null);
  const [amount, setAmount] = useState<5000 | 10000>(5000);
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers();
  }, [enforceCutoffRules]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = members.filter(
        (m) =>
          m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMembers(filtered);
    } else {
      setFilteredMembers(members);
    }
  }, [searchQuery, members]);

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
        const available = enforceCutoffRules
          ? data.filter((m: MemberSummaryView) => m.active_loans === 0)
          : data;
        setMembers(available);
        setFilteredMembers(available);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      setError('Please select a member');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: selectedMember.id,
          principal_amount: amount,
          release_date: releaseDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create loan');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalPayable = amount * 1.2;
  const installmentAmount = totalPayable / 10;

  return (
    <Modal isOpen={true} onClose={onClose} title="New Loan Application" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Cutoff Info */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {cutoff
              ? `Processing loan for cutoff: ${cutoff.cutoff_date}`
              : 'Historical/backfill mode: processing loan based on the selected release date'}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {cutoff
              ? `Remaining capacity: ${formatCurrency(cutoff.remaining_capacity)}`
              : 'Cutoff status, capacity, and existing active-loan restrictions are currently bypassed.'}
          </p>
        </div>

        {/* Member Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Member
          </label>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No eligible members found
              </div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMember(member)}
                  className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex justify-between items-center ${
                    selectedMember?.id === member.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                      : ''
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.full_name}
                    </p>
                    <p className="text-sm text-gray-500">{member.employee_id}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>Share: {formatCurrency(member.share_capital_amount)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Loan Amount */}
        <Select
          label="Loan Amount"
          value={amount.toString()}
          onChange={(v) => setAmount(Number(v) as 5000 | 10000)}
          options={[
            { value: '5000', label: 'PHP 5,000.00' },
            { value: '10000', label: 'PHP 10,000.00' },
          ]}
        />

        {/* Release Date */}
        <Input
          label="Release Date"
          type="date"
          value={releaseDate}
          onChange={setReleaseDate}
          required
        />

        {/* Loan Summary */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Principal Amount:</span>
            <span className="font-medium">{formatCurrency(amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Interest (20%):</span>
            <span className="font-medium">{formatCurrency(amount * 0.2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <span>Total Payable:</span>
            <span className="text-blue-600">{formatCurrency(totalPayable)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Installment Amount (10 cutoffs):</span>
            <span className="font-medium">{formatCurrency(installmentAmount)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!selectedMember}>
            Process Loan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
