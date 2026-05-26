/*
  # Database Functions and Views for TLSC System

  This migration adds:
  1. Loan ID generation function
  2. Receipt number generation function
  3. Member summary update function
  4. Cutoff totals update trigger
  5. Views for dashboard and reports
*/

-- Add function to generate unique loan IDs
CREATE OR REPLACE FUNCTION generate_loan_id()
RETURNS text AS $$
DECLARE
  new_id text;
  year_month text;
  seq_num integer;
BEGIN
  year_month := to_char(CURRENT_DATE, 'YYYYMM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(loan_id FROM 9 FOR 4) AS integer)), 0) + 1
  INTO seq_num
  FROM loans
  WHERE loan_id LIKE 'LN-' || year_month || '-%';
  
  new_id := 'LN-' || year_month || '-' || LPAD(seq_num::text, 4, '0');
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Add function to generate receipt numbers
CREATE OR REPLACE FUNCTION generate_receipt_number(prefix text DEFAULT 'RCP')
RETURNS text AS $$
DECLARE
  new_receipt text;
  year_month text;
  seq_num integer;
BEGIN
  year_month := to_char(CURRENT_DATE, 'YYYYMM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 9 FOR 5) AS integer)), 0) + 1
  INTO seq_num
  FROM loan_payments
  WHERE receipt_number LIKE prefix || '-' || year_month || '-%';
  
  new_receipt := prefix || '-' || year_month || '-' || LPAD(seq_num::text, 5, '0');
  
  RETURN new_receipt;
END;
$$ LANGUAGE plpgsql;

-- Add function to update member financial summary
CREATE OR REPLACE FUNCTION update_member_summary(target_member_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE members
  SET 
    total_loans = (
      SELECT COALESCE(SUM(principal_amount), 0)
      FROM loans
      WHERE member_id = target_member_id
    ),
    total_paid = (
      SELECT COALESCE(SUM(amount), 0)
      FROM loan_payments lp
      JOIN loans l ON lp.loan_id = l.id
      WHERE l.member_id = target_member_id
    ),
    remaining_balance = (
      SELECT COALESCE(SUM(remaining_balance), 0)
      FROM loans
      WHERE member_id = target_member_id AND status IN ('active', 'delayed')
    ),
    missed_payments = (
      SELECT COUNT(*)
      FROM loan_schedules ls
      JOIN loans l ON ls.loan_id = l.id
      WHERE l.member_id = target_member_id AND ls.is_missed = true
    ),
    share_capital_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM share_capitals
      WHERE member_id = target_member_id
    ),
    total_earnings = (
      SELECT COALESCE(SUM(principal_amount * 0.20), 0)
      FROM loans
      WHERE member_id = target_member_id AND status = 'fully_paid'
    ),
    updated_at = now()
  WHERE id = target_member_id;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update cutoff total released
CREATE OR REPLACE FUNCTION update_cutoff_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cutoff_periods
    SET 
      total_released = total_released + NEW.principal_amount,
      borrower_count = borrower_count + 1,
      updated_at = now()
    WHERE id = NEW.cutoff_period_id;
    
    -- Check if cutoff has reached max lending
    UPDATE cutoff_periods
    SET status = 'closed'
    WHERE id = NEW.cutoff_period_id 
    AND total_released >= max_lending;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'fully_paid' AND OLD.status != 'fully_paid' THEN
    -- Add to cutoff collections when loan is fully paid
    UPDATE cutoff_periods
    SET 
      total_collected = total_collected + NEW.total_payable,
      updated_at = now()
    WHERE id = NEW.cutoff_period_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists then create
DROP TRIGGER IF EXISTS trigger_update_cutoff_totals ON loans;
CREATE TRIGGER trigger_update_cutoff_totals
AFTER INSERT OR UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION update_cutoff_totals();

-- Create view for active loans with member details
CREATE OR REPLACE VIEW active_loans_view AS
SELECT 
  l.id,
  l.loan_id,
  m.employee_id,
  m.full_name AS member_name,
  m.position,
  l.principal_amount,
  l.total_payable,
  l.installment_amount,
  l.payments_made,
  l.remaining_balance,
  l.release_date,
  l.next_due_date,
  l.missed_payment_count,
  l.status,
  cp.cutoff_date,
  cp.cutoff_type
FROM loans l
JOIN members m ON l.member_id = m.id
JOIN cutoff_periods cp ON l.cutoff_period_id = cp.id
WHERE l.status IN ('active', 'delayed');

-- Create view for member summary
CREATE OR REPLACE VIEW member_summary_view AS
SELECT 
  m.id,
  m.employee_id,
  m.full_name,
  m.position,
  m.grade_handled,
  m.contact_number,
  m.address,
  m.date_joined,
  m.status,
  m.share_capital_amount,
  m.total_loans,
  m.total_paid,
  m.remaining_balance,
  m.missed_payments,
  m.total_earnings,
  COUNT(l.id) FILTER (WHERE l.status IN ('active', 'delayed')) AS active_loans,
  COUNT(l.id) FILTER (WHERE l.status = 'fully_paid') AS completed_loans
FROM members m
LEFT JOIN loans l ON m.id = l.member_id
GROUP BY m.id;

-- Create view for cutoff summary
CREATE OR REPLACE VIEW cutoff_summary_view AS
SELECT 
  cp.id,
  cp.cutoff_date,
  cp.cutoff_type,
  cp.status,
  cp.max_lending,
  cp.total_released,
  cp.total_collected,
  cp.borrower_count,
  cp.max_lending - cp.total_released AS remaining_capacity,
  COUNT(l.id) FILTER (WHERE l.status IN ('active', 'delayed')) AS active_loans,
  COUNT(l.id) FILTER (WHERE l.status = 'pending') AS pending_loans
FROM cutoff_periods cp
LEFT JOIN loans l ON cp.id = l.cutoff_period_id
GROUP BY cp.id;

-- Create view for dashboard metrics
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT 
  (SELECT COALESCE(SUM(amount), 0) FROM share_capitals) AS total_share_capital,
  (SELECT COALESCE(SUM(total_collected), 0) FROM cutoff_periods WHERE status = 'closed') AS total_historical_collections,
  (SELECT COUNT(*) FROM members WHERE status = 'active') AS active_members,
  (SELECT COUNT(*) FROM loans WHERE status IN ('active', 'delayed')) AS active_loans,
  (SELECT COALESCE(SUM(remaining_balance), 0) FROM loans WHERE status IN ('active', 'delayed')) AS outstanding_balance,
  (SELECT COUNT(*) FROM loan_schedules WHERE due_date = CURRENT_DATE AND status = 'pending') AS due_today,
  (SELECT COUNT(*) FROM loan_schedules WHERE due_date <= CURRENT_DATE AND status = 'pending') AS overdue_payments,
  (SELECT COALESCE(SUM(principal_amount * 0.20), 0) FROM loans WHERE status = 'fully_paid') AS total_earnings;