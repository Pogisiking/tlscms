-- Fix duplicate RLS policy creation for dividend modules.
-- If policy names already exist (e.g., from repeated migrations), this script drops them safely.

DO $$
BEGIN
  -- dividend_periods policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dividend_periods'
      AND policyname = 'Admins/Treasurers manage dividend periods'
  ) THEN
    EXECUTE 'DROP POLICY "Admins/Treasurers manage dividend periods" ON dividend_periods;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dividend_periods'
      AND policyname = 'Authenticated view dividend periods'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated view dividend periods" ON dividend_periods;';
  END IF;

  -- dividend_allocations policies
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dividend_allocations'
      AND policyname = 'Admins/Treasurers manage dividend allocations'
  ) THEN
    EXECUTE 'DROP POLICY "Admins/Treasurers manage dividend allocations" ON dividend_allocations;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dividend_allocations'
      AND policyname = 'Authenticated view dividend allocations'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated view dividend allocations" ON dividend_allocations;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dividend_allocations'
      AND policyname = 'Admins/Treasurers can modify allocations before final lock'
  ) THEN
    EXECUTE 'DROP POLICY "Admins/Treasurers can modify allocations before final lock" ON dividend_allocations;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dividend_allocations'
      AND policyname = 'Admins/Treasurers can delete allocations before final lock'
  ) THEN
    EXECUTE 'DROP POLICY "Admins/Treasurers can delete allocations before final lock" ON dividend_allocations;';
  END IF;
END$$;

-- Recreate canonical policies.
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

-- Allow admins/treasurers to manage dividend allocations
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

-- Allow staff/auditor to view dividend allocations
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

