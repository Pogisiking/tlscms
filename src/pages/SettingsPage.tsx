import { useEffect, useState } from 'react';
import { Save, Shield, Zap, Layers, Settings2, Database, Upload, Download, Users, FileSpreadsheet, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button } from '../components/common/DataCard';
import type { SystemConfig } from '../types/database';
import * as XLSX from 'xlsx';

export function SettingsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, any>>({});
  const [migrationStatus, setMigrationStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [resetEnabled, setResetEnabled] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/config`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConfigs(data || []);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = (type: 'members' | 'share-capital') => {
    const headers = type === 'members' 
      ? [['employee_id', 'full_name', 'position', 'contact_number', 'share_capital_amount', 'status']]
      : [['employee_id', 'amount', 'payment_date', 'notes']];
    
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${type}-template.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, type: 'members' | 'share-capital') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setMigrationStatus({ type: null, message: '' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const token = localStorage.getItem('auth_token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        };

        let successCount = 0;
        let failCount = 0;

        for (const row of data as any[]) {
          const endpoint = type === 'members' ? 'members' : 'share-capital';
          try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
              method: 'POST',
              headers,
              body: JSON.stringify(row)
            });
            if (response.ok) successCount++;
            else failCount++;
          } catch (fetchErr) {
            failCount++;
          }
        }

        setMigrationStatus({ 
          type: failCount === 0 ? 'success' : 'error', 
          message: `Import complete. ${successCount} records synced.${failCount > 0 ? ` ${failCount} failed.` : ''}` 
        });
      } catch (err) {
        setMigrationStatus({ type: 'error', message: 'Error parsing file format.' });
      } finally {
        setSaving(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');

      for (const [key, value] of Object.entries(editedConfigs)) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/config`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              config_key: key,
              config_value: value,
            }),
          }
        );
        if (!res.ok) throw new Error(`Failed to save ${key}`);
      }

      setEditedConfigs({});
      fetchConfigs();
    } catch (error) {
      console.error('Error saving configs:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async () => {
    if (!resetEnabled || resetPhrase !== 'RESET DATA') return;

    const confirmed = window.confirm(
      'This will permanently delete operational data including members, loans, payments, share capital, cutoffs, dividends, logs, notifications, and backups. Users, roles, settings, and database tables will remain. Do you really want to reset the data?'
    );
    if (!confirmed) return;

    setResetting(true);
    setResetStatus({ type: null, message: '' });

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/config/reset-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ confirmation: resetPhrase }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset data');

      setResetPhrase('');
      setResetEnabled(false);
      setResetStatus({ type: 'success', message: 'System data reset complete. Users, roles, settings, and tables were preserved.' });
    } catch (error) {
      setResetStatus({ type: 'error', message: error instanceof Error ? error.message : 'Failed to reset data' });
    } finally {
      setResetting(false);
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (config.config_key === 'enforce_cutoff_rules') return acc;
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, SystemConfig[]>);

  const categoryTitles: Record<string, string> = {
    lending: 'Lending Settings',
    system: 'System Settings',
    backup: 'Backup Settings',
    dividend: 'Dividend Settings',
    governance: 'Policy & Overrides',
    general: 'General Settings',
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="System Settings"
        description="Configure system parameters and options"
        actions={
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={Object.keys(editedConfigs).length === 0}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-10">
          {/* Data Migration Section */}
          <Card className="rounded-[2.5rem] border-indigo-100 dark:border-indigo-900/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-indigo-50/30 dark:bg-indigo-900/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase text-[12px] opacity-70">Infrastructure</h2>
                  <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">Data Migration Engine</p>
                </div>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-6 rounded-[2rem] border border-blue-500/10 bg-blue-500/5 transition-all hover:shadow-xl group">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900 group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Members Core Data</h3>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="secondary" onClick={() => downloadTemplate('members')} className="rounded-xl font-bold">
                      <Download className="w-4 h-4 mr-2" /> Get Template
                    </Button>
                    <label className="flex-1 min-w-[140px] relative flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white text-sm font-black uppercase tracking-wider rounded-xl cursor-pointer hover:bg-blue-700 transition-all">
                      <Upload className="w-4 h-4 mr-2" /> Upload & Sync
                      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => handleImport(e, 'members')} disabled={saving} />
                    </label>
                  </div>
                </div>
                <div className="p-6 rounded-[2rem] border border-purple-500/10 bg-purple-500/5 transition-all hover:shadow-xl group">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-900 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-6 h-6 text-purple-500" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Ledger History</h3>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="secondary" onClick={() => downloadTemplate('share-capital')} className="rounded-xl font-bold">
                      <Download className="w-4 h-4 mr-2" /> Get Template
                    </Button>
                    <label className="flex-1 min-w-[140px] relative flex items-center justify-center px-6 py-2.5 bg-purple-600 text-white text-sm font-black uppercase tracking-wider rounded-xl cursor-pointer hover:bg-purple-700 transition-all">
                      <Upload className="w-4 h-4 mr-2" /> Upload & Sync
                      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => handleImport(e, 'share-capital')} disabled={saving} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Policy & Governance Section */}
          <Card className="rounded-[2.5rem] border-rose-100 dark:border-rose-900/50 bg-rose-50/10 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl shadow-rose-500/5 overflow-hidden">
            <div className="px-8 py-6 border-b border-inherit bg-white/40 dark:bg-gray-800/40 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase text-[12px] opacity-70">Governance</h2>
                  <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">System Policy Overrides</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">
                <Zap className="w-3 h-3 fill-current" /> Critical Access
              </div>
            </div>
            <div className="p-8">
              {migrationStatus.type && (
                <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 ${
                  migrationStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {migrationStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <p className="text-sm font-black">{migrationStatus.message}</p>
                </div>
              )}
              <div className="flex items-center justify-between p-6 rounded-3xl border border-rose-500/20 bg-white/30 dark:bg-gray-800/20 backdrop-blur-sm group hover:shadow-xl transition-all duration-500">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-rose-100 dark:border-rose-900 group-hover:scale-110 transition-transform">
                    <Layers className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Cutoff Rule Enforcement</h3>
                    <p className="text-sm text-gray-500 font-medium">Disable for historical backfill: loans can be recorded by release date regardless of cutoff status, capacity, or existing active loans.</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ConfigEditor 
                    value={editedConfigs.enforce_cutoff_rules ?? configs.find(c => c.config_key === 'enforce_cutoff_rules')?.config_value ?? true} 
                    onChange={(val) => setEditedConfigs(prev => ({ ...prev, enforce_cutoff_rules: val }))}
                  />
                  {('enforce_cutoff_rules' in editedConfigs) && (
                    <span className="text-[10px] font-black uppercase text-blue-600 animate-pulse">Pending Save</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* System Reset Section */}
          <Card className="rounded-[2.5rem] border-rose-100 dark:border-rose-900/50 bg-rose-50/10 dark:bg-slate-900/50 backdrop-blur-xl shadow-2xl shadow-rose-500/5 overflow-hidden">
            <div className="px-8 py-6 border-b border-inherit bg-white/40 dark:bg-gray-800/40 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase text-[12px] opacity-70">Danger Zone</h2>
                  <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">Reset Operational Data</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">
                <AlertCircle className="w-3 h-3" /> Destructive
              </div>
            </div>
            <div className="p-8 space-y-6">
              {resetStatus.type && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 ${
                  resetStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {resetStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <p className="text-sm font-black">{resetStatus.message}</p>
                </div>
              )}

              <div className="p-6 rounded-3xl border border-rose-500/20 bg-white/30 dark:bg-gray-800/20 backdrop-blur-sm space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Enable Data Reset</h3>
                    <p className="text-sm text-gray-500 font-medium">
                      Deletes operational records only. Database tables, users, roles, and settings remain intact.
                    </p>
                  </div>
                  <ConfigEditor value={resetEnabled} onChange={(value) => setResetEnabled(Boolean(value))} />
                </div>

                {resetEnabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-rose-600 mb-2">
                        Type RESET DATA to confirm
                      </label>
                      <input
                        type="text"
                        value={resetPhrase}
                        onChange={(e) => setResetPhrase(e.target.value)}
                        className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-900 border border-rose-200 dark:border-rose-900 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all outline-none text-gray-900 dark:text-white"
                        placeholder="RESET DATA"
                      />
                    </div>
                    <Button
                      variant="danger"
                      onClick={handleResetData}
                      loading={resetting}
                      disabled={resetPhrase !== 'RESET DATA'}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Reset Data
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => {
            const categoryStyle = {
              lending: 'border-blue-100 dark:border-blue-900/50 shadow-blue-500/5 bg-blue-50/5',
              system: 'border-purple-100 dark:border-purple-900/50 shadow-purple-500/5 bg-purple-50/5',
              backup: 'border-emerald-100 dark:border-emerald-900/50 shadow-emerald-500/5 bg-emerald-50/5',
              dividend: 'border-indigo-100 dark:border-indigo-900/50 shadow-indigo-500/5 bg-indigo-50/5',
              general: 'border-slate-100 dark:border-slate-900/50 shadow-slate-500/5 bg-slate-50/5',
            }[category] || 'border-gray-100 shadow-sm';

            return (
              <Card key={category} className={`rounded-[2.5rem] border ${categoryStyle} overflow-hidden transition-all duration-500`}>
                <div className="px-8 py-5 border-b border-inherit bg-white/40 dark:bg-gray-800/40 backdrop-blur-md flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-inherit">
                    <Settings2 className="w-4 h-4 opacity-70" />
                  </div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight uppercase text-[12px] opacity-80">
                    {categoryTitles[category] || category}
                  </h2>
                </div>
                <div className="p-8 space-y-6">
                {categoryConfigs.map((config) => {
                  const k = config.config_key;
                  const isEdited = k in editedConfigs;
                  const currentValue = isEdited
                    ? editedConfigs[k]
                    : config.config_value;

                  return (
                    <div key={config.id} className={`p-6 rounded-3xl border backdrop-blur-sm transition-all duration-300 ${
                      isEdited 
                        ? 'border-blue-500/30 bg-blue-500/5 shadow-xl shadow-blue-500/5' 
                        : 'border-gray-200/50 dark:border-gray-700/50 bg-white/30 dark:bg-gray-800/20'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {k.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </p>
                          {config.description && (
                            <p className="text-sm text-gray-500">{config.description}</p>
                          )}
                        </div>
                        {isEdited && (
                          <span className="text-xs text-blue-600 font-medium">Modified</span>
                        )}
                      </div>

                      <ConfigEditor
                        value={currentValue}
                        onChange={(value) => {
                          setEditedConfigs((prev) => ({
                            ...prev,
                            [k]: value,
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
          })}
        </div>
      )}
    </div>
  );
}

function ConfigEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const inputBase = "px-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-gray-900 dark:text-white shadow-inner";

  if (typeof value === 'boolean') {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-4 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
          value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${
            value ? 'translate-x-7' : 'translate-x-0'
          }`}
        />
      </button>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
          <div key={key} className="flex items-center gap-4">
            <label className="text-sm text-gray-600 dark:text-gray-400 w-40">{key}:</label>
            <input
              type={typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'checkbox' : 'text'}
              value={typeof val === 'boolean' ? undefined : String(val)}
              checked={typeof val === 'boolean' ? Boolean(val) : undefined}
              onChange={(e) => {
                let newValue: unknown;
                if (typeof val === 'boolean') {
                  newValue = e.target.checked;
                } else if (typeof val === 'number') {
                  newValue = Number(e.target.value);
                } else {
                  newValue = e.target.value;
                }
                onChange({ ...(value as Record<string, unknown>), [key]: newValue });
              }}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <input
      type="text"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full ${inputBase}`}
    />
  );
}
