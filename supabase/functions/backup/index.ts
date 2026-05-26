import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BackupData {
  generated_at: string;
  database: string;
  tables: Record<string, unknown[]>;
  summary: {
    total_members: number;
    total_loans: number;
    total_payments: number;
    total_share_capitals: number;
    total_cutoffs: number;
    total_earnings: number;
  };
}

async function generateBackup(): Promise<BackupData> {
  const tables = [
    'users', 'roles', 'members', 'share_capitals', 'loans',
    'loan_schedules', 'loan_payments', 'cutoff_periods',
    'audit_logs', 'notifications', 'system_config', 'activity_logs'
  ];

  const backupData: BackupData = {
    generated_at: new Date().toISOString(),
    database: 'teachers_lending_db',
    tables: {},
    summary: {
      total_members: 0,
      total_loans: 0,
      total_payments: 0,
      total_share_capitals: 0,
      total_cutoffs: 0,
      total_earnings: 0
    }
  };

  // Export each table
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(10000);

      if (!error && data) {
        backupData.tables[table] = data;
      }
    } catch (e) {
      console.error(`Error backing up table ${table}:`, e);
    }
  }

  // Generate summary
  const { data: metrics } = await supabase
    .from('dashboard_metrics')
    .select('*')
    .single();

  if (metrics) {
    backupData.summary = {
      total_members: metrics.active_members || 0,
      total_loans: metrics.active_loans || 0,
      total_payments: 0,
      total_share_capitals: 0,
      total_cutoffs: 0,
      total_earnings: metrics.total_earnings || 0
    };
  }

  // Get counts
  const { count: membersCount } = await supabase.from('members').select('*', { count: 'exact', head: true });
  const { count: loansCount } = await supabase.from('loans').select('*', { count: 'exact', head: true });
  const { count: paymentsCount } = await supabase.from('loan_payments').select('*', { count: 'exact', head: true });
  const { count: shareCapitalsCount } = await supabase.from('share_capitals').select('*', { count: 'exact', head: true });
  const { count: cutoffsCount } = await supabase.from('cutoff_periods').select('*', { count: 'exact', head: true });

  backupData.summary.total_members = membersCount || 0;
  backupData.summary.total_loans = loansCount || 0;
  backupData.summary.total_payments = paymentsCount || 0;
  backupData.summary.total_share_capitals = shareCapitalsCount || 0;
  backupData.summary.total_cutoffs = cutoffsCount || 0;

  return backupData;
}

async function sendBackupNotification(email: string, backupData: BackupData) {
  // This function would integrate with email service
  // For now, we'll just log it
  console.log(`Backup notification would be sent to ${email}`);
  console.log(`Backup summary:`, backupData.summary);
  return true;
}

async function uploadToGoogleDrive(folderId: string, filename: string, content: string) {
  // This function would integrate with Google Drive API
  // For now, we'll just log it
  console.log(`Backup would be uploaded to Google Drive folder ${folderId}`);
  console.log(`Filename: ${filename}`);
  return true;
}

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const tokenData = JSON.parse(atob(token));
    return tokenData.user_id;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/backup')[1] || '/';
  const userId = getUserId(req);

  try {
    // Create backup
    if (path === '/create' && req.method === 'POST') {
      const body = await req.json();
      const { send_email, upload_google_drive, google_folder_id, email_recipient } = body;

      const backupData = await generateBackup();
      const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
      const content = JSON.stringify(backupData, null, 2);

      // Log backup
      const { data: backupLog, error } = await supabase
        .from('backup_logs')
        .insert({
          backup_type: 'manual',
          file_path: filename,
          file_size: content.length,
          status: 'completed',
          completed_at: new Date().toISOString(),
          created_by: userId
        })
        .select()
        .single();

      // Send email if requested
      if (send_email && email_recipient) {
        await sendBackupNotification(email_recipient, backupData);
      }

      // Upload to Google Drive if requested
      if (upload_google_drive && google_folder_id) {
        await uploadToGoogleDrive(google_folder_id, filename, content);
      }

      // Update backup log with actions taken
      await supabase
        .from('backup_logs')
        .update({
          error_message: JSON.stringify({
            email_sent: send_email && email_recipient,
            google_drive_uploaded: upload_google_drive && google_folder_id
          })
        })
        .eq('id', backupLog.id);

      return new Response(
        JSON.stringify({
          success: true,
          backup: backupData,
          filename,
          backup_id: backupLog.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get backup logs
    if (path === '/logs' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get backup configuration
    if (path === '/config' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .in('config_key', ['backup_settings', 'google_drive_backup', 'email_backup', 'organization_info']);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const config: Record<string, unknown> = {};
      data?.forEach(item => {
        config[item.config_key] = item.config_value;
      });

      return new Response(
        JSON.stringify(config),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update backup configuration
    if (path === '/config' && req.method === 'PUT') {
      const body = await req.json();

      for (const [key, value] of Object.entries(body)) {
        await supabase
          .from('system_config')
          .update({
            config_value: value,
            updated_at: new Date().toISOString()
          })
          .eq('config_key', key);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
