-- Profit sharing gating + safe defaults
-- Adds a settings key that controls when dividends become available.

DO $$
BEGIN
  -- Ensure settings row exists
  IF NOT EXISTS (
    SELECT 1 FROM settings WHERE key = 'audit_3rd_year_approved'
  ) THEN
    INSERT INTO settings (key, value, description, is_public)
    VALUES (
      'audit_3rd_year_approved',
      '{"approved": false}'::jsonb,
      'When true, profit sharing/dividends can be computed/finalized (after 3rd-year audit approval).',
      false
    );
  END IF;
END$$;

