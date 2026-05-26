import { useEffect, useState } from 'react';
import { CreditCard, Clock, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import { Button, Badge, Card, Modal } from '../common/DataCard';
import type { Loan, LoanSchedule, LoanPayment } from '../../types/database';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { RecordPaymentModal } from './RecordPaymentModal';

interface LoanDetailsModalProps {
  loan: Loan;
  onClose: () => void;
  onUpdate: () => void;
}

export function LoanDetailsModal({ loan, onClose, onUpdate }: LoanDetailsModalProps) {
  const [loanDetails, setLoanDetails] = useState<Loan>(loan);
  const [schedules, setSchedules] = useState<LoanSchedule[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    setLoanDetails(loan);
    fetchLoanDetails();
  }, [loan.id]);

  const fetchLoanDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans/${loan.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLoanDetails(data);
        setSchedules(data.schedules || []);
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error('Error fetching loan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentRecorded = () => {
    setShowPaymentModal(false);
    fetchLoanDetails();
    onUpdate();
  };

  const progress = (loanDetails.payments_made / loanDetails.total_installments) * 100;

  return (
    <Modal isOpen={true} onClose={onClose} title={`Loan ${loanDetails.loan_id}`} size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Member Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Borrower</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {loanDetails.member?.full_name}
              </p>
              <p className="text-sm text-gray-500">{loanDetails.member?.employee_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Principal Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(loanDetails.principal_amount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Payable</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(loanDetails.total_payable)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Remaining Balance</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(loanDetails.remaining_balance)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-500">Payment Progress</span>
              <span className="text-sm font-medium">
                {loanDetails.payments_made}/{loanDetails.total_installments} payments
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-600 rounded-full h-3 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="text-center">
              <DollarSign className="w-6 h-6 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold">{formatCurrency(loanDetails.installment_amount)}</p>
              <p className="text-xs text-gray-500">Per Installment</p>
            </Card>
            <Card className="text-center">
              <Clock className="w-6 h-6 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold">{loanDetails.missed_payment_count}</p>
              <p className="text-xs text-gray-500">Missed Payments</p>
            </Card>
            <Card className="text-center">
              <TrendingUp className="w-6 h-6 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold">{formatCurrency(loanDetails.principal_amount * 0.2)}</p>
              <p className="text-xs text-gray-500">Interest Earned</p>
            </Card>
            <Card className="text-center">
              <AlertCircle className="w-6 h-6 mx-auto text-gray-400 mb-1" />
              <p className="text-lg font-bold capitalize">{loanDetails.status.replace('_', ' ')}</p>
              <p className="text-xs text-gray-500">Status</p>
            </Card>
          </div>

          {/* Payment Button */}
          {loanDetails.status !== 'fully_paid' && loanDetails.status !== 'closed' && (
            <Button onClick={() => setShowPaymentModal(true)} className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}

          {/* Payment Schedule */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Payment Schedule
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    schedule.status === 'paid'
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : schedule.is_missed
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">
                      Installment #{schedule.installment_number}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(schedule.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        schedule.status === 'paid'
                          ? 'success'
                          : schedule.is_missed
                          ? 'danger'
                          : 'info'
                      }
                    >
                      {schedule.status}
                    </Badge>
                    <span className="font-medium">{formatCurrency(schedule.amount_due)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Payment History
              </h3>
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">{payment.payment_method}</p>
                      <p className="text-xs text-gray-500">{formatDate(payment.payment_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-gray-500">{payment.receipt_number}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showPaymentModal && (
        <RecordPaymentModal
          loan={loanDetails}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentRecorded}
        />
      )}
    </Modal>
  );
}
