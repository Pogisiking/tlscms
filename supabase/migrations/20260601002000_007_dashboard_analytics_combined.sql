/*
  COMBINED SQL (copy/paste friendly)
  Dashboard Analytics views (cash, metrics, analytics series)

  This includes:
  - dashboard_cash_on_hand
  - current_open_cutoff
  - dashboard_metrics
  - dashboard_monthly_collections
  - dashboard_loan_distribution
  - dashboard_financial_trends
  - dashboard_earnings_trends
  - dashboard_delinquency_reports
*/

-- Cash on hand
CREATE OR REPLACE VIEW dashboard_cash_on_hand AS
SELECT
  (
    COALESCE((SELECT SUM(amount) FROM share_capitals), 0)
    + COALESCE((SELECT SUM(amount) FROM loan_payments), 0)
    - COALESCE((SELECT SUM(total_collected) FROM cutoff_periods WHERE status = 'closed'), 0)
  ) AS cash_on_hand;

-- Current open cutoff
CREATE OR REPLACE VIEW current_open_cutoff AS
SELECT *
FROM cutoff_periods
WHERE status = 'open'
ORDER BY cutoff_date DESC
LIMIT 1;

-- Recreate dashboard_metrics to avoid CREATE OR REPLACE rename issues
DROP VIEW IF EXISTS dashboard_metrics CASCADE;

CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
  (SELECT COALESCE(SUM(amount), 0) FROM share_capitals) AS total_share_capital,
  (SELECT COALESCE(cash_on_hand, 0) FROM dashboard_cash_on_hand) AS cash_on_hand,
  (SELECT COALESCE(SUM(total_collected), 0) FROM cutoff_periods WHERE status = 'closed') AS total_historical_collections,
  (SELECT COUNT(*) FROM members WHERE status = 'active') AS active_members,
  (SELECT COUNT(*) FROM loans WHERE status IN ('active', 'delayed')) AS active_loans,
  (SELECT COALESCE(SUM(remaining_balance), 0) FROM loans WHERE status IN ('active', 'delayed')) AS outstanding_balance,
  (SELECT COALESCE(SUM(principal_amount * 0.20), 0) FROM loans WHERE status = 'fully_paid') AS total_earnings,
  (SELECT COUNT(*) FROM loan_schedules WHERE due_date = CURRENT_DATE AND status = 'pending') AS due_today,
  (SELECT COUNT(*) FROM loan_schedules WHERE due_date <= CURRENT_DATE AND status = 'pending') AS overdue_payments,
  (
    SELECT COUNT(*)
    FROM loan_schedules ls
    JOIN loans l ON ls.loan_id = l.id
    JOIN current_open_cutoff coc ON l.cutoff_period_id = coc.id
    WHERE ls.due_date = CURRENT_DATE
      AND ls.status = 'pending'
  ) AS due_this_cutoff,
  (
    SELECT COALESCE(SUM(lp.amount), 0)
    FROM loan_payments lp
    JOIN loans l ON lp.loan_id = l.id
    JOIN current_open_cutoff coc ON l.cutoff_period_id = coc.id
  ) AS collected_this_cutoff,
  (
    SELECT COUNT(*)
    FROM loan_schedules ls
    JOIN loans l ON ls.loan_id = l.id
    WHERE ls.is_missed = true OR ls.status = 'missed'
  ) AS delayed_payments;

-- Monthly collections series (last 12 months)
CREATE OR REPLACE VIEW dashboard_monthly_collections AS
SELECT
  to_char(DATE_TRUNC('month', lp.payment_date), 'YYYY-MM') AS month,
  SUM(lp.amount) AS collected
FROM loan_payments lp
WHERE lp.payment_date >= (CURRENT_DATE - INTERVAL '11 months')
GROUP BY 1
ORDER BY 1;

-- Loan distribution by status
CREATE OR REPLACE VIEW dashboard_loan_distribution AS
SELECT
  CASE
    WHEN status = 'active' THEN 'active'
    WHEN status = 'delayed' THEN 'delayed'
    WHEN status = 'fully_paid' THEN 'fully_paid'
    WHEN status = 'pending' THEN 'pending'
    ELSE 'other'
  END AS label,
  COUNT(*) AS count
FROM loans
WHERE status IN ('active','delayed','fully_paid','pending')
GROUP BY 1
ORDER BY 1;

-- Financial trends: outstanding vs due (approx)
CREATE OR REPLACE VIEW dashboard_financial_trends AS
WITH months AS (
  SELECT generate_series(0, 11) AS i
), series AS (
  SELECT
    to_char(DATE_TRUNC('month', CURRENT_DATE) - (i || ' months')::interval, 'YYYY-MM') AS month
  FROM months
)
SELECT
  s.month,
  COALESCE(
    (
      SELECT SUM(l.remaining_balance)
      FROM loans l
      WHERE l.release_date <= (s.month || '-01')::date
        AND l.status IN ('active','delayed')
    ), 0
  ) AS outstanding,
  COALESCE(
    (
      SELECT COUNT(*)
      FROM loan_schedules ls
      WHERE ls.due_date >= (s.month || '-01')::date
        AND ls.due_date < (s.month || '-01')::date + INTERVAL '1 month'
        AND ls.status = 'pending'
    ), 0
  ) AS due
FROM series s
ORDER BY s.month;

-- Earnings trends: monthly earnings based on fully paid loans' release date (approx)
CREATE OR REPLACE VIEW dashboard_earnings_trends AS
SELECT
  to_char(DATE_TRUNC('month', l.release_date), 'YYYY-MM') AS month,
  SUM(l.principal_amount * 0.20) AS earnings
FROM loans l
WHERE l.status = 'fully_paid'
  AND l.release_date >= (CURRENT_DATE - INTERVAL '11 months')
GROUP BY 1
ORDER BY 1;

-- Delinquency reports (bucket by missed count)
CREATE OR REPLACE VIEW dashboard_delinquency_reports AS
SELECT
  CASE
    WHEN missed_payment_count = 0 THEN '0 missed'
    WHEN missed_payment_count BETWEEN 1 AND 2 THEN '1-2 missed'
    WHEN missed_payment_count BETWEEN 3 AND 5 THEN '3-5 missed'
    ELSE '6+ missed'
  END AS label,
  COUNT(*) AS count
FROM loans
WHERE status IN ('active','delayed')
GROUP BY 1
ORDER BY 1;

