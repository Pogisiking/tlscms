# Teachers Lending & Share Capital Management System

Enterprise-level full-stack web application for managing a school-based lending cooperative system.

## Super Admin Login Credentials

**IMPORTANT: Change these credentials immediately after first login!**

```
Email: admin@teacherscooperative.com
Password: Admin@2024!
```

## Features

### Core Modules
- **Dashboard** - Real-time metrics and overview
- **Member Management** - Complete member profiles with financial summaries
- **Share Capital** - One-time contribution tracking
- **Loans** - Full lending cycle management with cutoff periods
- **Payments** - Payment collection with receipt generation
- **Reports** - Exportable financial and audit reports
- **Audit Trail** - Complete transaction history
- **Backup System** - Database backup with email/Google Drive integration
- **Settings** - Dynamic system configuration

### Lending Rules
- Loan amounts: PHP 5,000 or PHP 10,000 only
- Interest rate: 20% (PHP 5,000 loan = PHP 6,000 payable, PHP 10,000 loan = PHP 12,000 payable)
- Repayment: 10 equal installments every cutoff (mid-month and end-month)
- Maximum lending per cutoff: PHP 10,000
- Partial payments: NOT allowed
- Advance payments: ALLOWED

### User Roles
1. **Admin** - Full system access
2. **Treasurer** - Loan and payment management
3. **Staff** - Limited operational access
4. **Auditor** - View-only access for auditing

## System Configuration

All settings can be modified through the Settings page:
- Loan rules (amounts, interest, installments)
- Cutoff schedules
- Payment processing rules
- Notification settings
- Backup settings (email and Google Drive)
- Organization information

## Backup System

The system supports:
1. Manual backup downloads (JSON format)
2. Email backup delivery (configure recipient in settings)
3. Google Drive backup upload (configure folder ID in settings)

To configure:
1. Go to Settings page
2. Update `email_backup` or `google_drive_backup` configuration
3. Use the Backup page to create and send backups

## Database Structure

The Supabase database includes:
- Users and roles tables (RBAC system)
- Members with financial summaries
- Share capitals (one per member)
- Loans with automatic scheduling
- Loan schedules for payment tracking
- Payment records with receipts
- Cutoff periods with capacity management
- System configuration
- Audit logs (all changes tracked)
- Activity logs (user sessions)

## Edge Functions Deployed

1. `auth` - Authentication system
2. `dashboard` - Dashboard metrics
3. `members` - Member management
4. `loans` - Loan processing
5. `payments` - Payment recording
6. `reports` - Report generation
7. `audit` - Audit and activity logs
8. `backup` - Backup management
9. `config` - System configuration
10. `shares` - Share capital management

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Custom JWT-based auth
- **Icons**: Lucide React
- **State Management**: Zustand

## Security Features

- Password hashing (bcrypt)
- Account lockout after 5 failed attempts
- Session management
- Row Level Security (RLS) on all tables
- Role-based access control
- Complete audit trail
- IP address logging

## Getting Started

1. Login with super admin credentials above
2. Change the default password immediately
3. Add members through the Members page
4. Record share capital contributions
5. Process loans during open cutoff periods
6. Record payments as they come in
7. Generate reports as needed
8. Configure backup settings
9. Set up additional user accounts as needed

## API Integration

The system is designed for future integration:
- SMS gateway ready (configure in settings)
- Email service ready (configure in settings)
- Google Drive API ready (configure in settings)
- External accounting systems connection point

## Financial Integrity

The system ensures:
- Automatic loan balance tracking
- Member financial summaries
- Cutoff capacity enforcement
- Audit-ready transaction logs
- No data deletion (soft deletes)
- Complete change history

For support or issues, check the Audit Trail section in the application.
