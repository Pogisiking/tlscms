import { useEffect, useState } from 'react';
import { Edit, Search, Trash2, UserPlus } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Badge, Modal, Table } from '../components/common/DataCard';
import type { MemberSummaryView } from '../types/database';
import { formatCurrency, formatDate } from '../utils/formatters';
import { MemberFormModal } from '../components/members/MemberFormModal';

export function MembersPage() {
  const [members, setMembers] = useState<MemberSummaryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSummaryView | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [searchQuery, statusFilter]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMembers(data || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberAdded = () => {
    setShowAddModal(false);
    fetchMembers();
  };

  const columns = [
    {
      key: 'employee_id',
      header: 'Employee ID',
      render: (member: MemberSummaryView) => (
        <span className="font-mono text-sm">{member.employee_id}</span>
      ),
    },
    {
      key: 'full_name',
      header: 'Name',
      render: (member: MemberSummaryView) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{member.full_name}</p>
          <p className="text-sm text-gray-500">{member.position || 'No position'}</p>
        </div>
      ),
    },
    {
      key: 'share_capital',
      header: 'Share Capital',
      render: (member: MemberSummaryView) => (
        <span className="font-medium">{formatCurrency(member.share_capital_amount)}</span>
      ),
    },
    {
      key: 'loans',
      header: 'Loans',
      render: (member: MemberSummaryView) => (
        <div>
          <p className="font-medium">
            {member.active_loans > 0 && (
              <span className="text-blue-600">{member.active_loans} active</span>
            )}
            {member.active_loans === 0 && member.completed_loans > 0 && (
              <span className="text-gray-500">{member.completed_loans} completed</span>
            )}
            {member.active_loans === 0 && member.completed_loans === 0 && (
              <span className="text-gray-400">None</span>
            )}
          </p>
          {member.remaining_balance > 0 && (
            <p className="text-sm text-gray-500">{formatCurrency(member.remaining_balance)} bal</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member: MemberSummaryView) => (
        <Badge variant={member.status === 'active' ? 'success' : 'default'}>
          {member.status}
        </Badge>
      ),
    },
    {
      key: 'date_joined',
      header: 'Joined',
      render: (member: MemberSummaryView) => (
        <span className="text-sm text-gray-500">{formatDate(member.date_joined)}</span>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Members"
        description="Manage cooperative members and their profiles"
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        }
      />

      <Card padding="none">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search members by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <Table
          columns={columns as any}
          data={members as any}
          keyExtractor={(member: any) => member.id}
          loading={loading}
          emptyMessage="No members found"
          onRowClick={(member: any) => setSelectedMember(member)}
        />
      </Card>

      {showAddModal && (
        <MemberFormModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleMemberAdded}
        />
      )}

      {selectedMember && (
        <MemberDetailsModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onUpdate={fetchMembers}
        />
      )}
    </div>
  );
}

function MemberDetailsModal({
  member,
  onClose,
  onUpdate,
}: {
  member: MemberSummaryView;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleDelete = async () => {
    const confirmed = window.confirm(`Delete ${member.full_name}? This will mark the member as inactive.`);
    if (!confirmed) return;

    setDeleting(true);
    setActionError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members?id=${encodeURIComponent(member.id)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete member');

      onUpdate();
      onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete member');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdited = () => {
    setShowEditModal(false);
    onUpdate();
    onClose();
  };

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title={member.full_name} size="xl">
        <div className="space-y-6">
        {actionError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-sm">
            {actionError}
          </div>
        )}

        {/* Member Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Employee ID</p>
            <p className="font-mono font-medium">{member.employee_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Position</p>
            <p className="font-medium">{member.position || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Grade Handled</p>
            <p className="font-medium">{member.grade_handled || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date Joined</p>
            <p className="font-medium">{formatDate(member.date_joined)}</p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="text-sm text-gray-500">Share Capital</p>
            <p className="text-xl font-bold text-blue-600">
              {formatCurrency(member.share_capital_amount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Loans</p>
            <p className="text-xl font-bold">{formatCurrency(member.total_loans)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Remaining Balance</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(member.remaining_balance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Missed Payments</p>
            <p className="text-xl font-bold text-yellow-600">{member.missed_payments}</p>
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
              {['overview', 'loans', 'payments'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Contact Number</p>
                  <p className="font-medium">{member.contact_number || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{member.address || 'Not provided'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Active Loans</p>
                    <p className="text-2xl font-bold">{member.active_loans}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Completed Loans</p>
                    <p className="text-2xl font-bold text-green-600">{member.completed_loans}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'loans' && (
              <div className="text-center py-8 text-gray-500">
                View loan history in the Loans section
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="text-center py-8 text-gray-500">
                View payment history in the Payments section
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-5 border-t border-gray-200 dark:border-gray-800">
          <Button variant="secondary" onClick={() => setShowEditModal(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Member
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Member
          </Button>
        </div>
      </div>
      </Modal>

      {showEditModal && (
        <MemberFormModal
          member={member}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEdited}
        />
      )}
    </>
  );
}
