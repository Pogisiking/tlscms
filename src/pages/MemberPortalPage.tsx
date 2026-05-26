import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, Clock, AlertCircle, CheckCircle, Wallet, CreditCard, BarChart3, LogOut } from 'lucide-react';
import { Card, Badge } from '../components/common/DataCard';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import type { MemberSummaryView, Loan, LoanPayment, ShareCapital } from '../types/database';

interface MemberData {
  member: MemberSummaryView;
  loans: Loan[];
  payments: LoanPayment[];
  shareCapital: ShareCapital | null;
}

export function MemberPortalPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchMemberData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    navigate('/member-login');
  };

  const fetchMemberData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Get member data from token
      const tokenData = JSON.parse(atob(token));
      const memberId = tokenData.member_id;

      if (!memberId) {
        setError('Member ID not found in session');
        return;
      }

      // Fetch member summary
      const memberResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members?id=${memberId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!memberResponse.ok) {
        throw new Error('Failed to fetch member data');
      }

      const member = await memberResponse.json();

      // Fetch member's loans
      const loansResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans?member_id=${memberId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const loans = loansResponse.ok ? await loansResponse.json() : [];

      // Fetch member's payments
      const paymentsResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments?member_id=${memberId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const payments = paymentsResponse.ok ? await paymentsResponse.json() : [];

      // Fetch member's share capital
      const sharesResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shares?member_id=${memberId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const sharesData = sharesResponse.ok ? await sharesResponse.json() : null;
      const shareCapital = sharesData && sharesData.length > 0 ? sharesData[0] : null;

      setData({
        member,
        loans: loans || [],
        payments: payments || [],
        shareCapital,
      });
    } catch (err) {
      console.error('Error fetching member data:', err);
      setError('Failed to load your data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading your information...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Data</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{error || 'Unable to load your data'}</p>
            <button
              onClick={fetchMemberData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const { member, loans, payments, shareCapital } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {member.full_name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Employee ID: {member.employee_id} | {member.position || 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={member.status === 'active' ? 'success' : 'default'} className="text-sm px-4 py-1">
                {member.status === 'active' ? 'Active Member' : 'Inactive'}
              </Badge>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-blue-500/5 ring-1 ring-blue-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Share Capital</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(member.share_capital_amount)}
                </p>
                <p className="text-xs mt-2 opacity-70">
                  {shareCapital ? `Paid on ${formatDate(shareCapital.payment_date)}` : 'Not yet contributed'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-inherit">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-emerald-500/5 ring-1 ring-emerald-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Total Loans Availed</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(member.total_loans)}</p>
                <p className="text-xs mt-2 opacity-70">
                  {loans.length} loan{loans.length !== 1 ? 's' : ''} total
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-inherit">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-amber-500/5 ring-1 ring-amber-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Total Paid</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(member.total_paid)}</p>
                <p className="text-xs mt-2 opacity-70">
                  {payments.length} payment{payments.length !== 1 ? 's' : ''} made
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-inherit">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className={member.remaining_balance > 0 ? 'bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-rose-500/5 ring-1 ring-rose-500/10' : 'bg-slate-500/5 text-slate-600 dark:text-slate-400 border-slate-500/20 shadow-slate-500/5 ring-1 ring-slate-500/10'}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">
                  Remaining Balance
                </p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(member.remaining_balance)}</p>
                <p className="text-xs mt-2 opacity-70">
                  {member.remaining_balance > 0 ? 'Outstanding balance' : 'Fully paid'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-inherit">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Earnings Contributed</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(member.total_earnings)}
                </p>
                <p className="text-xs text-gray-400">Interest earnings from your loans</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${member.missed_payments > 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'}`}>
                <AlertCircle className={`w-6 h-6 ${member.missed_payments > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Missed Payments</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {member.missed_payments}
                </p>
                <p className="text-xs text-gray-400">
                  {member.missed_payments > 0 ? 'Requires attention' : 'Great payment record!'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Loan Status</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                  {member.active_loans > 0 ? `${member.active_loans} Active Loan${member.active_loans > 1 ? 's' : ''}` : 'No Active Loans'}
                </p>
                <p className="text-xs text-gray-400">
                  {member.completed_loans} completed | {member.active_loans} active
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs Section */}
        <Card>
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'share', label: 'Share Capital', icon: DollarSign },
                { id: 'loans', label: 'My Loans', icon: CreditCard },
                { id: 'payments', label: 'Payment History', icon: Clock },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Employee ID</span>
                        <span className="font-mono font-medium text-gray-900 dark:text-white">{member.employee_id}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Full Name</span>
                        <span className="font-medium text-gray-900 dark:text-white">{member.full_name}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Position</span>
                        <span className="text-gray-900 dark:text-white">{member.position || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Grade Handled</span>
                        <span className="text-gray-900 dark:text-white">{member.grade_handled || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Contact Number</span>
                        <span className="text-gray-900 dark:text-white">{member.contact_number || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Address</span>
                        <span className="text-gray-900 dark:text-white text-right max-w-[200px]">{member.address || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">Date Joined</span>
                        <span className="text-gray-900 dark:text-white">{formatDate(member.date_joined)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Financial Summary</h3>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Share Capital</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(member.share_capital_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Total Loans</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(member.total_loans)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Total Paid</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(member.total_paid)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Remaining Balance</span>
                        <span className={`text-lg font-bold ${member.remaining_balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {formatCurrency(member.remaining_balance)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Earnings Contributed</span>
                        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(member.total_earnings)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Missed Payments</span>
                        <span className={`text-lg font-bold ${member.missed_payments > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {member.missed_payments}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'share' && (
              <div>
                {shareCapital ? (
                  <div className="max-w-lg mx-auto">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white mb-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-blue-100 text-sm">One-Time Share Capital</p>
                          <p className="text-3xl font-bold mt-1">{formatCurrency(shareCapital.amount)}</p>
                        </div>
                        <DollarSign className="w-12 h-12 text-blue-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-blue-400">
                        <div>
                          <p className="text-blue-100 text-xs">Date Contributed</p>
                          <p className="font-medium">{formatDate(shareCapital.payment_date)}</p>
                        </div>
                        <div>
                          <p className="text-blue-100 text-xs">Receipt Number</p>
                          <p className="font-mono font-medium">{shareCapital.receipt_number || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    {shareCapital.notes && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                        <p className="text-gray-900 dark:text-white">{shareCapital.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Share Capital Recorded</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Your share capital contribution has not been recorded yet. Please contact the cooperative office.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'loans' && (
              <div>
                {loans.length > 0 ? (
                  <div className="space-y-4">
                    {loans.map((loan) => (
                      <div
                        key={loan.id}
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-mono text-sm text-gray-500">{loan.loan_id}</span>
                              <Badge variant={
                                loan.status === 'active' ? 'info' :
                                loan.status === 'fully_paid' ? 'success' :
                                loan.status === 'delayed' ? 'warning' : 'default'
                              }>
                                {loan.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500 dark:text-gray-400">Principal</p>
                                <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(loan.principal_amount)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 dark:text-gray-400">Total Payable</p>
                                <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(loan.total_payable)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 dark:text-gray-400">Remaining</p>
                                <p className="font-medium text-red-600 dark:text-red-400">{formatCurrency(loan.remaining_balance)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 dark:text-gray-400">Payments Made</p>
                                <p className="font-medium text-gray-900 dark:text-white">{loan.payments_made}/{loan.total_installments}</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Released</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(loan.release_date)}</p>
                            {loan.next_due_date && (
                              <>
                                <p className="text-xs text-gray-400 mt-2">Next Due</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(loan.next_due_date)}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Loans Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      You haven't availed any loans yet. Visit the cooperative office to apply.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payments' && (
              <div>
                {payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
                          <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                          <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="py-3 text-sm text-gray-900 dark:text-white">{formatDate(payment.payment_date)}</td>
                            <td className="py-3 text-sm font-mono text-gray-500">{payment.loan_id || 'N/A'}</td>
                            <td className="py-3 text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(payment.amount)}</td>
                            <td className="py-3 text-sm font-mono text-gray-500">{payment.receipt_number || 'N/A'}</td>
                            <td className="py-3 text-sm text-gray-500 capitalize">{payment.payment_method || 'cash'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Payments Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Your payment history will appear here once you make payments.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
