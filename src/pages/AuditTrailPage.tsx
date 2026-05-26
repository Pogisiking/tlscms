import { useEffect, useState } from 'react';
import { Search, Filter, Clock, User, Database } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Badge } from '../components/common/DataCard';
import type { AuditLog } from '../types/database';
import { formatDateTime } from '../utils/formatters';

export function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableNameFilter, setTableNameFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [tableNameFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (tableNameFilter) params.append('table', tableNameFilter);
      if (actionFilter) params.append('action', actionFilter);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit/logs?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLogs(data || []);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const actionColors = {
    INSERT: 'success',
    UPDATE: 'warning',
    DELETE: 'danger',
  } as const;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Audit Trail"
        description="Track all system changes and user actions"
      />

      <Card padding="none">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={tableNameFilter}
              onChange={(e) => setTableNameFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Tables</option>
              <option value="members">Members</option>
              <option value="loans">Loans</option>
              <option value="loan_payments">Payments</option>
              <option value="share_capitals">Share Capitals</option>
              <option value="users">Users</option>
              <option value="system_config">Settings</option>
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Actions</option>
              <option value="INSERT">Insert</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No audit logs found</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg mt-1">
                      <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {log.table_name}
                        </span>
                        <Badge variant={actionColors[log.action as keyof typeof actionColors] || 'default'}>
                          {log.action}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        by {log.user?.full_name || log.user?.email || 'System'}
                      </p>
                      {log.old_values && log.new_values && (
                        <div className="mt-2 text-xs">
                          <p className="text-gray-500">Changes:</p>
                          <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 overflow-x-auto">
                            {JSON.stringify(
                              Object.keys(log.new_values).filter(
                                (k) =>
                                  JSON.stringify(log.old_values?.[k]) !==
                                  JSON.stringify(log.new_values[k])
                              ).reduce((obj, key) => {
                                obj[key] = {
                                  from: log.old_values?.[key],
                                  to: log.new_values[key],
                                };
                                return obj;
                              }, {} as Record<string, unknown>),
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(log.created_at)}
                    </div>
                    {log.ip_address && (
                      <p className="text-xs text-gray-400">{log.ip_address}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
