import { useState } from 'react';
import { Button, Input, Select } from '../common/DataCard';

interface MemberFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
  member?: {
    id: string;
    employee_id: string;
    full_name: string;
    position?: string | null;
    grade_handled?: string | null;
    contact_number?: string | null;
    address?: string | null;
    date_joined: string;
    status: string;
  };
}

export function MemberFormModal({ onClose, onSuccess, member }: MemberFormModalProps) {
  const [formData, setFormData] = useState({
    employee_id: member?.employee_id || '',
    full_name: member?.full_name || '',
    position: member?.position || '',
    grade_handled: member?.grade_handled || '',
    contact_number: member?.contact_number || '',
    address: member?.address || '',
    date_joined: member?.date_joined || new Date().toISOString().split('T')[0],
    status: member?.status || 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members`;

      const response = await fetch(url, {
        method: member ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(member ? { ...formData, id: member.id } : formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save member');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {member ? 'Edit Member' : 'Add New Member'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Employee ID"
                value={formData.employee_id}
                onChange={(v) => handleChange('employee_id', v)}
                required
                placeholder="EMP-001"
              />
              <Input
                label="Date Joined"
                type="date"
                value={formData.date_joined}
                onChange={(v) => handleChange('date_joined', v)}
                required
              />
            </div>

            <Input
              label="Full Name"
              value={formData.full_name}
              onChange={(v) => handleChange('full_name', v)}
              required
              placeholder="John Doe"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Position"
                value={formData.position}
                onChange={(v) => handleChange('position', v)}
                placeholder="Teacher"
              />
              <Input
                label="Grade Handled"
                value={formData.grade_handled}
                onChange={(v) => handleChange('grade_handled', v)}
                placeholder="Grade 5"
              />
            </div>

            <Input
              label="Contact Number"
              value={formData.contact_number}
              onChange={(v) => handleChange('contact_number', v)}
              placeholder="09123456789"
            />

            <Input
              label="Address"
              value={formData.address}
              onChange={(v) => handleChange('address', v)}
              placeholder="Complete address"
            />

            <Select
              label="Status"
              value={formData.status}
              onChange={(v) => handleChange('status', v)}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {member ? 'Update' : 'Add Member'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
