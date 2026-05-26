export type UserRole = 'admin' | 'auditor' | 'treasurer' | 'staff';
export type MemberStatus = 'active' | 'inactive';
export type LoanStatus = 'pending' | 'active' | 'fully_paid' | 'delayed' | 'closed';
export type PaymentStatus = 'paid' | 'missed' | 'pending';
export type CutoffType = 'mid_month' | 'end_month';
export type CutoffStatus = 'open' | 'closed';

export interface Role {
  id: string;
  name: UserRole;
  description: string | null;
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  role?: Role;
  is_active: boolean;
  is_locked: boolean;
  failed_login_attempts: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  employee_id: string;
  full_name: string;
  position: string | null;
  grade_handled: string | null;
  contact_number: string | null;
  address: string | null;
  date_joined: string;
  status: MemberStatus;
  profile_picture_url: string | null;
  total_loans: number;
  total_paid: number;
  remaining_balance: number;
  missed_payments: number;
  share_capital_amount: number;
  total_earnings: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ShareCapital {
  id: string;
  member_id: string;
  member?: Member;
  amount: number;
  payment_date: string;
  receipt_number: string | null;
  is_locked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CutoffPeriod {
  id: string;
  cutoff_date: string;
  cutoff_type: CutoffType;
  status: CutoffStatus;
  max_lending: number;
  total_released: number;
  total_collected: number;
  borrower_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Loan {
  id: string;
  loan_id: string;
  member_id: string;
  member?: Member;
  cutoff_period_id: string;
  cutoff_period?: CutoffPeriod;
  principal_amount: 5000 | 10000;
  total_payable: number;
  installment_amount: number;
  total_installments: number;
  payments_made: number;
  remaining_balance: number;
  release_date: string;
  status: LoanStatus;
  missed_payment_count: number;
  next_due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface LoanSchedule {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  amount_due: number;
  status: PaymentStatus;
  actual_payment_date: string | null;
  amount_paid: number;
  is_missed: boolean;
  missed_carryover: number;
  created_at: string;
  updated_at: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  schedule_id: string | null;
  payment_date: string;
  amount: number;
  receipt_number: string | null;
  payment_method: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user?: User;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  config_key: string;
  config_value: Record<string, unknown>;
  data_type: string;
  is_editable: boolean;
  description: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  total_share_capital: number;
  total_historical_collections: number;
  active_members: number;
  active_loans: number;
  outstanding_balance: number;
  due_today: number;
  overdue_payments: number;
  total_earnings: number;
}

export interface ActiveLoanView {
  id: string;
  loan_id: string;
  employee_id: string;
  member_name: string;
  position: string | null;
  principal_amount: number;
  total_payable: number;
  installment_amount: number;
  payments_made: number;
  remaining_balance: number;
  release_date: string;
  next_due_date: string | null;
  missed_payment_count: number;
  status: LoanStatus;
  cutoff_date: string;
  cutoff_type: CutoffType;
}

export interface MemberSummaryView {
  id: string;
  employee_id: string;
  full_name: string;
  position: string | null;
  grade_handled: string | null;
  contact_number: string | null;
  address: string | null;
  date_joined: string;
  status: MemberStatus;
  share_capital_amount: number;
  total_loans: number;
  total_paid: number;
  remaining_balance: number;
  missed_payments: number;
  total_earnings: number;
  active_loans: number;
  completed_loans: number;
}

export interface CutoffSummaryView {
  id: string;
  cutoff_date: string;
  cutoff_type: CutoffType;
  status: CutoffStatus;
  max_lending: number;
  total_released: number;
  total_collected: number;
  borrower_count: number;
  remaining_capacity: number;
  active_loans: number;
  pending_loans: number;
}

// --- Dashboard Analytics DTOs (edge function responses) ---

export interface MonthlyCollectionsPoint {
  month: string;
  collected: number;
}

export interface LoanDistributionPoint {
  label: string;
  count: number;
}

export interface FinancialTrendPoint {
  month: string;
  outstanding: number;
  due: number;
}

export interface EarningsTrendPoint {
  month: string;
  earnings: number;
}

export interface DelinquencyReportPoint {
  label: string;
  count: number;
}

// --- Dividends module DTOs ---

export type DividendPeriodStatus =
  | 'pending'
  | 'estimated_approved'
  | 'audit_pending'
  | 'audit_approved'
  | 'final_locked';

export interface DividendPeriod {
  id: string;
  fiscal_year: number;
  cutoff_date: string | null;
  status: DividendPeriodStatus;
  total_cooperative_earnings: number;
  total_share_capital: number;
  created_at: string;
  updated_at: string;
}

export interface DividendMemberAllocation {
  id: string;
  dividend_period_id: string;
  member_id: string;
  member_full_name: string;
  employee_id: string;
  member_share_capital: number;
  ownership_percent: number;
  profit_share_estimated: number | null;
  profit_share_final: number | null;
}



