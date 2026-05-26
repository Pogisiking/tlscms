/*
  Dividends module schema

  Adds:
  - dividend_periods: tracks dividend computation lifecycle per fiscal year
  - dividend_allocations: per-member allocation results (estimated + final)
  - Views for dashboard-like listing and allocations
*/

-- Dividend period status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dividend_period_status') THEN
    CREATE TYPE dividend_period_status AS ENUM (
      'pending',
      'estimated_approved',
      'audit_pending',
      'audit_approved',
      'final_locked'
    );
  END IF;
END$$;

-- Dividend period table
CREATE TABLE IF NOT EXISTS dividend_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year integer NOT NULL,
  cutoff_date date,
  status dividend_period_status NOT NULL DEFAULT 'pending',

  -- Source profit used for distribution
  total_cooperative_earnings numeric(12,2) DEFAULT 0 NOT NULL,

  -- Snapshot of share capital at computation time
  total_share_capital numeric(12,2) DEFAULT 0 NOT NULL,

  -- Optimistic locking
  computed_by uuid REFERENCES users(id),
  computed_at timestamptz,
  locked_by uuid REFERENCES users(id),
  locked_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),

  UNIQUE (fiscal_year, cutoff_date)
);

-- Dividend allocations per member
CREATE TABLE IF NOT EXISTS dividend_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dividend_period_id uuid REFERENCES dividend_periods(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,

  member_share_capital numeric(12,2) DEFAULT 0 NOT NULL,
  ownership_percent numeric(12,6) DEFAULT 0 NOT NULL,

  profit_share_estimated numeric(12,2),
  profit_share_final numeric(12,2),

  audit_notes text,
  status text DEFAULT 'active',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (dividend_period_id, member_id)
);

-- Views
CREATE OR REPLACE VIEW dividend_periods_view AS
SELECT
  dp.id,
  dp.fiscal_year,
  dp.cutoff_date,
  dp.status,
  dp.total_cooperative_earnings,
  dp.total_share_capital,
  dp.created_at,
  dp.updated_at
FROM dividend_periods dp
ORDER BY dp.fiscal_year DESC, dp.cutoff_date DESC NULLS LAST;

CREATE OR REPLACE VIEW dividend_allocations_view AS
SELECT
  da.id,
  da.dividend_period_id,
  da.member_id,
  m.full_name AS member_full_name,
  m.employee_id,
  da.member_share_capital,
  da.ownership_percent,
  da.profit_share_estimated,
  da.profit_share_final
FROM dividend_allocations da
JOIN members m ON m.id = da.member_id;

-- RLS
ALTER TABLE dividend_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_allocations ENABLE ROW LEVEL SECURITY;

-- Allow admins/treasurers to manage dividend periods
CREATE POLICY "Admins/Treasurers manage dividend periods"
  ON dividend_periods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin','treasurer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin','treasurer')
    )
  );

-- Allow staff/auditor to view dividend periods
CREATE POLICY "Authenticated view dividend periods"
  ON dividend_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins/Treasurers manage dividend allocations"
  ON dividend_allocations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin','treasurer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin','treasurer')
    )
  );

CREATE POLICY "Authenticated view dividend allocations"
  ON dividend_allocations FOR SELECT
  TO authenticated
  USING (true);

-- Prevent modifications after final lock
-- Admins/treasurers may update/delete only when the parent period is NOT final_locked
CREATE POLICY "Admins/Treasurers can modify allocations before final lock"
  ON dividend_allocations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM dividend_periods dp
      WHERE dp.id = dividend_allocations.dividend_period_id
        AND dp.status <> 'final_locked'
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name IN ('admin','treasurer')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM dividend_periods dp
      WHERE dp.id = dividend_allocations.dividend_period_id
        AND dp.status <> 'final_locked'
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name IN ('admin','treasurer')
      )
    )
  );

CREATE POLICY "Admins/Treasurers can delete allocations before final lock"
  ON dividend_allocations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM dividend_periods dp
      WHERE dp.id = dividend_allocations.dividend_period_id
        AND dp.status <> 'final_locked'
    )
    AND (
      EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name IN ('admin','treasurer')
      )
    )
  );


