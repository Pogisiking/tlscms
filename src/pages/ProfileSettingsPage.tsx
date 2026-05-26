import { useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, Search, Shield, UserCog } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Badge } from '../components/common/DataCard';
import { useAuthStore } from '../stores/authStore';
import type { MemberSummaryView } from '../types/database';

function defaultMemberPassword(employeeId: string) {
  return `${employeeId.slice(-3)}123`;
}

export function ProfileSettingsPage() {
  const { user } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const [members, setMembers] = useState<MemberSummaryView[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [resettingMember, setResettingMember] = useState(false);
  const [memberStatus, setMemberStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      return member.full_name.toLowerCase().includes(q) || member.employee_id.toLowerCase().includes(q);
    });
  }, [members, search]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (response.ok) {
        setMembers((await response.json()) || []);
      }
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    void fetchMembers();
  }, []);

  useEffect(() => {
    if (!selectedMember) return;
    setEmployeeId(selectedMember.employee_id);
    setMemberPassword(defaultMemberPassword(selectedMember.employee_id));
  }, [selectedMember]);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus({ type: null, message: '' });

    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to change password');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus({ type: 'success', message: 'Password changed. Use your new password next time you sign in.' });
    } catch (error) {
      setPasswordStatus({ type: 'error', message: error instanceof Error ? error.message : 'Failed to change password' });
    } finally {
      setSavingPassword(false);
    }
  };

  const resetMemberCredentials = async () => {
    if (!selectedMember) return;

    const confirmed = window.confirm(`Reset login credentials for ${selectedMember.full_name}?`);
    if (!confirmed) return;

    setResettingMember(true);
    setMemberStatus({ type: null, message: '' });

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/reset-member-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          member_id: selectedMember.id,
          employee_id: employeeId,
          password: memberPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset member credentials');

      setMemberStatus({
        type: 'success',
        message: `Credentials reset. Username: ${data.credentials.employee_id} | Temporary password: ${data.credentials.temporary_password}`,
      });
      await fetchMembers();
    } catch (error) {
      setMemberStatus({ type: 'error', message: error instanceof Error ? error.message : 'Failed to reset member credentials' });
    } finally {
      setResettingMember(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Profile Settings"
        description="Account supervision and credential management"
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card className="xl:col-span-1 overflow-hidden" padding="none">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Admin Account</h2>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>

          <form onSubmit={changePassword} className="p-8 space-y-5">
            {passwordStatus.type && (
              <div className={`p-3 rounded-xl text-sm font-medium ${
                passwordStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
              }`}>
                {passwordStatus.message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>

            <Button type="submit" loading={savingPassword} className="w-full">
              <KeyRound className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </form>
        </Card>

        <Card className="xl:col-span-2 overflow-hidden" padding="none">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800">
                <UserCog className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Member Credential Supervision</h2>
                <p className="text-sm text-gray-500">View usernames and reset member login passwords.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={fetchMembers} loading={loadingMembers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="p-8 space-y-6">
            {memberStatus.type && (
              <div className={`p-3 rounded-xl text-sm font-medium ${
                memberStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
              }`}>
                {memberStatus.message}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search member name or username..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors ${
                      selectedMemberId === member.id ? 'bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{member.full_name}</p>
                        <p className="text-sm text-gray-500">Username: {member.employee_id}</p>
                      </div>
                      <Badge variant={member.status === 'active' ? 'success' : 'default'}>{member.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-5 border border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20 space-y-4">
                {selectedMember ? (
                  <>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-gray-500">Selected Member</p>
                      <p className="text-lg font-black text-gray-900 dark:text-white">{selectedMember.full_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username / Employee ID</label>
                      <input
                        value={employeeId}
                        onChange={(e) => {
                          const next = e.target.value.toUpperCase();
                          setEmployeeId(next);
                          setMemberPassword(defaultMemberPassword(next));
                        }}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Temporary Password</label>
                      <input
                        value={memberPassword}
                        onChange={(e) => setMemberPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <Button onClick={resetMemberCredentials} loading={resettingMember} className="w-full">
                      <KeyRound className="w-4 h-4 mr-2" />
                      Reset Member Credentials
                    </Button>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">Select a member to view or reset login credentials.</div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
