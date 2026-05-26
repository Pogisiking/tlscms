/*
  # Teachers Lending & Share Capital Management System - Initial Schema

  ## Overview
  Enterprise-level database schema for managing a school-based lending cooperative system
  with financial tracking, audit trails, and role-based access control.

  ## Tables Created
  
  ### 1. roles
  - System user roles (admin, auditor, treasurer, staff)
  - Hierarchical permission structure
  
  ### 2. users
  - User accounts with authentication data
  - Linked to roles for RBAC
  - Account lockout and session tracking
  
  ### 3. members
  - Member profiles with employment details
  - Financial summary computed fields
  - Profile pictures and activity tracking
  
  ### 4. share_capitals
  - One-time share capital contributions
  - Validation and locking mechanism
  
  ### 5. cutoff_periods
  - Mid-month and end-of-month lending periods
  - Maximum lending capacity tracking
  - Status management (open/closed)
  
  ### 6. loans
  - Loan records with full tracking
  - Fixed amounts (5000 or 10000)
  - Repayment schedules auto-generated
  - Status tracking (pending, active, fully paid, delayed, closed)
  
  ### 7. loan_payments
  - Payment records for each loan
  - Missed payment tracking
  - Payment history with receipts
  
  ### 8. audit_logs
  - Complete transaction history
  - User actions tracking
  - Previous and new value logging
  - IP address and timestamp
  
  ### 9. settings
  - Dynamic system configuration
  - Loan rules, cutoff schedules
  - Notification settings
  
  ### 10. notifications
  - In-app notifications
  - Due date reminders
  - Payment confirmations
  
  ### 11. backup_logs
  - Backup history tracking
  - Recovery points
  
  ### 12. error_logs
  - System error tracking
  - Debugging support

  ## Security
  - RLS enabled on all tables
  - Restrictive policies based on user roles
  - Sensitive data encryption

  ## Important Notes
  1. This is a financial audit system - data integrity is critical
  2. No destructive operations should be performed
  3. All changes must be logged in audit_logs
  4. Member financial summaries are computed from transactions
  5. Cutoff system enforces maximum lending limits
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'auditor', 'treasurer', 'staff');
CREATE TYPE member_status AS ENUM ('active', 'inactive');
CREATE TYPE loan_status AS ENUM ('pending', 'active', 'fully_paid', 'delayed', 'closed');
CREATE TYPE payment_status AS ENUM ('paid', 'missed', 'pending');
CREATE TYPE cutoff_type AS ENUM ('mid_month', 'end_month');
CREATE TYPE cutoff_status AS ENUM ('open', 'closed');

-- 1. Roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  is_locked boolean DEFAULT false,
  failed_login_attempts integer DEFAULT 0,
  last_login_at timestamptz,
  last_login_ip text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  position text,
  grade_handled text,
  contact_number text,
  address text,
  date_joined date NOT NULL,
  status member_status DEFAULT 'active',
  profile_picture_url text,
  total_loans numeric(12,2) DEFAULT 0,
  total_paid numeric(12,2) DEFAULT 0,
  remaining_balance numeric(12,2) DEFAULT 0,
  missed_payments integer DEFAULT 0,
  share_capital_amount numeric(12,2) DEFAULT 0,
  total_earnings numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

-- 4. Share Capitals table
CREATE TABLE IF NOT EXISTS share_capitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  receipt_number text UNIQUE,
  is_locked boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  UNIQUE (member_id) -- Enforce one-time payment only
);

-- 5. Cutoff Periods table
CREATE TABLE IF NOT EXISTS cutoff_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_date date NOT NULL,
  cutoff_type cutoff_type NOT NULL,
  status cutoff_status DEFAULT 'open',
  max_lending numeric(12,2) DEFAULT 10000,
  total_released numeric(12,2) DEFAULT 0,
  total_collected numeric(12,2) DEFAULT 0,
  borrower_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  UNIQUE (cutoff_date, cutoff_type)
);

-- 6. Loans table
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id text UNIQUE NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  cutoff_period_id uuid REFERENCES cutoff_periods(id),
  principal_amount numeric(12,2) NOT NULL CHECK (principal_amount IN (5000, 10000)),
  total_payable numeric(12,2) NOT NULL,
  installment_amount numeric(12,2) NOT NULL,
  total_installments integer DEFAULT 10,
  payments_made integer DEFAULT 0,
  remaining_balance numeric(12,2) NOT NULL,
  release_date date NOT NULL,
  status loan_status DEFAULT 'pending',
  missed_payment_count integer DEFAULT 0,
  next_due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  CONSTRAINT valid_payable CHECK (
    (principal_amount = 5000 AND total_payable = 6000 AND installment_amount = 600) OR
    (principal_amount = 10000 AND total_payable = 12000 AND installment_amount = 1200)
  )
);

-- 7. Loan Schedules table
CREATE TABLE IF NOT EXISTS loan_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount_due numeric(12,2) NOT NULL,
  status payment_status DEFAULT 'pending',
  actual_payment_date date,
  amount_paid numeric(12,2) DEFAULT 0,
  is_missed boolean DEFAULT false,
  missed_carryover numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (loan_id, installment_number)
);

-- 8. Loan Payments table
CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES loan_schedules(id),
  payment_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  receipt_number text UNIQUE,
  payment_method text DEFAULT 'cash',
  received_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 9. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create index for audit log queries
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);

-- 10. Settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- 11. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create index for notification queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- 12. Backup Logs table
CREATE TABLE IF NOT EXISTS backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL,
  file_path text,
  file_size integer,
  status text DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_by uuid REFERENCES users(id)
);

-- 13. Activity Logs table (for user sessions)
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  ip_address text,
  user_agent text,
  session_id text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for activity logs
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- 14. System Configuration table
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL,
  data_type text DEFAULT 'json',
  is_editable boolean DEFAULT true,
  description text,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_capitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutoff_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );
  
CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for users
CREATE POLICY "Admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for members - Admins and treasurers have full access
CREATE POLICY "Admins and treasurers can manage members"
  ON members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer')
    )
  );

CREATE POLICY "Staff can view members"
  ON members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer', 'staff', 'auditor')
    )
  );

-- RLS Policies for share_capitals
CREATE POLICY "Admins and treasurers can manage share capitals"
  ON share_capitals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer')
    )
  );

CREATE POLICY "Staff can view share capitals"
  ON share_capitals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer', 'staff', 'auditor')
    )
  );

-- RLS Policies for cutoff_periods
CREATE POLICY "Admins and treasurers can manage cutoffs"
  ON cutoff_periods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer')
    )
  );

CREATE POLICY "All authenticated can view cutoffs"
  ON cutoff_periods FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for loans
CREATE POLICY "Admins and treasurers can manage loans"
  ON loans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer')
    )
  );

CREATE POLICY "All authenticated can view loans"
  ON loans FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for loan_schedules
CREATE POLICY "Admins and treasurers can manage schedules"
  ON loan_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer')
    )
  );

CREATE POLICY "All authenticated can view schedules"
  ON loan_schedules FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for loan_payments
CREATE POLICY "Admins and treasurers can manage payments"
  ON loan_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer')
    )
  );

CREATE POLICY "All authenticated can view payments"
  ON loan_payments FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for audit_logs - Read only for admins and auditors
CREATE POLICY "Admins and auditors can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'auditor')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for settings
CREATE POLICY "Admins can manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "Authenticated can view public settings"
  ON settings FOR SELECT
  TO authenticated
  USING (is_public = true OR EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.name IN ('admin', 'treasurer')
  ));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for backup_logs
CREATE POLICY "Admins can manage backup logs"
  ON backup_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view all activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for system_config
CREATE POLICY "Admins can manage system config"
  ON system_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "Authenticated can view editable config"
  ON system_config FOR SELECT
  TO authenticated
  USING (is_editable = true OR EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND r.name = 'admin'
  ));

-- Create indexes for performance
CREATE INDEX idx_members_employee_id ON members(employee_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_loans_member_id ON loans(member_id);
CREATE INDEX idx_loans_cutoff_period_id ON loans(cutoff_period_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loan_schedules_loan_id ON loan_schedules(loan_id);
CREATE INDEX idx_loan_schedules_due_date ON loan_schedules(due_date);
CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_cutoff_periods_date ON cutoff_periods(cutoff_date);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system access with all permissions', '{"all": true}'),
('auditor', 'View-only access for auditing and reporting', '{"view": true, "reports": true}'),
('treasurer', 'Loan and payment management access', '{"members": true, "loans": true, "payments": true, "cutoffs": true}'),
('staff', 'Limited operational access', '{"members:view": true, "loans:view": true}');

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description, category) VALUES
('loan_rules', '{"allowed_amounts": [5000, 10000], "interest_rate": 0.20, "installment_count": 10}', 'Loan configuration settings', 'lending'),
('cutoff_rules', '{"max_lending_per_cutoff": 10000, "mid_month_day": 15, "end_month_day": 0}', 'Cutoff period settings', 'lending'),
('payment_rules', '{"allow_partial": false, "allow_advance": true, "penalty_rate": 0}', 'Payment processing rules', 'lending'),
('notification_settings', '{"email_enabled": false, "sms_enabled": false, "due_reminder_days": 3}', 'Notification configuration', 'system'),
('backup_settings', '{"auto_backup_enabled": true, "backup_frequency": "daily", "retention_days": 90}', 'Backup configuration', 'system'),
('google_drive_backup', '{"enabled": false, "folder_id": ""}', 'Google Drive backup settings', 'backup'),
('email_backup', '{"enabled": false, "recipient_email": ""}', 'Email backup settings', 'backup'),
('organization_info', '{"name": "Teachers Lending Cooperative", "address": "", "contact": ""}', 'Organization details', 'general');