import { useState, useEffect } from 'react';
import { Download, Cloud, Mail, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Input } from '../components/common/DataCard';
import { StatCard } from '../components/common/StatCard';

interface BackupLog {
  id: string;
  backup_type: string;
  file_path: string;
  file_size: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export function BackupPage() {
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchBackupData();
  }, []);

  const fetchBackupData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');

      const [logsRes, configRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup/logs`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup/config`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setBackupLogs(data || []);
      }

      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data || {});
      }
    } catch (error) {
      console.error('Error fetching backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async (sendEmail: boolean = false, uploadGDrive: boolean = false) => {
    setCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            send_email: sendEmail,
            upload_google_drive: uploadGDrive,
            email_recipient: config.email_backup?.recipient_email || '',
            google_folder_id: config.google_drive_backup?.folder_id || '',
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Download the backup file
        const blob = new Blob([JSON.stringify(data.backup, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);

        fetchBackupData();
      }
    } catch (error) {
      console.error('Error creating backup:', error);
    } finally {
      setCreating(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const lastBackup = backupLogs[0];

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Backup & Recovery"
        description="Manage system backups and data exports"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Backups"
          value={backupLogs.length}
          subtitle="Created backups"
          color="blue"
        />
        <StatCard
          title="Last Backup"
          value={lastBackup ? new Date(lastBackup.started_at).toLocaleDateString() : 'Never'}
          subtitle={lastBackup ? formatBytes(lastBackup.file_size) : ''}
          color="green"
        />
        <StatCard
          title="Backup Status"
          value={lastBackup?.status || 'N/A'}
          color={lastBackup?.status === 'completed' ? 'green' : 'yellow'}
        />
      </div>

      {/* Backup Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="text-center">
          <Download className="w-12 h-12 mx-auto text-blue-600 mb-4" />
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
            Download Backup
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Create and download a full database backup
          </p>
          <Button
            onClick={() => handleCreateBackup(false, false)}
            loading={creating}
            className="w-full"
          >
            Create Backup
          </Button>
        </Card>

        <Card className="text-center">
          <Mail className="w-12 h-12 mx-auto text-green-600 mb-4" />
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
            Email Backup
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Send backup to configured email address
          </p>
          <Button
            onClick={() => handleCreateBackup(true, false)}
            loading={creating}
            variant="secondary"
            className="w-full"
          >
            Email Backup
          </Button>
        </Card>

        <Card className="text-center">
          <Cloud className="w-12 h-12 mx-auto text-purple-600 mb-4" />
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
            Google Drive Backup
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Upload backup to Google Drive
          </p>
          <Button
            onClick={() => handleCreateBackup(false, true)}
            loading={creating}
            variant="secondary"
            className="w-full"
          >
            Upload to Drive
          </Button>
        </Card>
      </div>

      {/* Backup History */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Backup History
        </h2>
        {backupLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No backups created yet</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {backupLogs.map((log) => (
              <div key={log.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    log.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : log.status === 'failed'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    {log.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {log.file_path}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatBytes(log.file_size)} - {log.backup_type} backup
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>{new Date(log.started_at).toLocaleDateString()}</p>
                  <p>{new Date(log.started_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
