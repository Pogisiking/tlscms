import { useState } from 'react';
import { Button, Input, Select, Modal } from '../common/DataCard';
import { AlertCircle, CheckCircle } from 'lucide-react';
import type { Loan } from '../../types/database';
import { formatCurrency } from '../../utils/formatters';

interface RecordPaymentModalProps {
  loan: Loan;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentModal({ loan, onClose, onSuccess }: RecordPaymentModalProps) {
  const [paymentType, setPaymentType] = useState<'installment' | 'full'>('installment');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            loan_id: loan.id,
            payment_type: paymentType,
            amount: paymentType === 'full' ? loan.remaining_balance : loan.installment_amount,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            notes: notes || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const paymentAmount = paymentType === 'full' ? loan.remaining_balance : loan.installment_amount;
  const remainingInstallments = Math.max(loan.total_installments - loan.payments_made, 0);

  if (success) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Payment Recorded" size="md">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Payment Successfully Recorded
          </p>
          <p className="text-sm text-gray-500">
            Receipt has been generated
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Record Payment" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Loan Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm text-gray-500">Loan ID</p>
              <p className="font-mono font-medium">{loan.loan_id}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Remaining Balance</p>
              <p className="font-bold text-red-600">{formatCurrency(loan.remaining_balance)}</p>
            </div>
          </div>
        </div>

        {/* Payment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Payment Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentType('installment')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                paymentType === 'installment'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
            >
              <p className="font-medium">One Installment</p>
              <p className="text-xs opacity-75">Record the next scheduled payment</p>
            </button>
            <button
              type="button"
              onClick={() => setPaymentType('full')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                paymentType === 'full'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              }`}
            >
              <p className="font-medium">Fully Paid</p>
              <p className="text-xs opacity-75">Settle the full remaining balance</p>
            </button>
          </div>
        </div>

        {/* Payment Amount */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Payment Amount</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatCurrency(paymentAmount)}
              </p>
            </div>
            <div className="text-right text-sm text-blue-600 dark:text-blue-400">
              {paymentType === 'full' ? (
                <>
                  <p>Marks loan as fully paid</p>
                  <p>{remainingInstallments} remaining installment{remainingInstallments !== 1 ? 's' : ''}</p>
                </>
              ) : (
                <p>Installment #{loan.payments_made + 1} of {loan.total_installments}</p>
              )}
            </div>
          </div>
        </div>

        <Input
          label="Payment Date"
          type="date"
          value={paymentDate}
          onChange={setPaymentDate}
          required
        />

        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'check', label: 'Check' },
          ]}
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
            {paymentType === 'full' ? 'Mark Fully Paid' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
