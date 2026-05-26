/*
  # Add password_hash column to members table

  This allows members to have their own login credentials.
  Default password is: last 3 characters of employee_id + "123"
  Example: EMO-001 -> default password is "001123"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE members ADD COLUMN password_hash text;
  END IF;
END $$;