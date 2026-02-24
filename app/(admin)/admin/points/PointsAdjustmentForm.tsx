'use client';

import { useState, useEffect } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { adjustUserPoints, getUsers } from './actions';

interface PointsAdjustmentFormProps {
  isDevMode: boolean;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  role: string;
}

export default function PointsAdjustmentForm({ isDevMode }: PointsAdjustmentFormProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [deltaPoints, setDeltaPoints] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = () => {
    if (!isDevMode) {
      setLoadingUsers(true);
      getUsers()
        .then((fetchedUsers) => {
          console.log('Received users:', fetchedUsers);
          setUsers(fetchedUsers);
          setLoadingUsers(false);
        })
        .catch((error) => {
          console.error('Error loading users:', error);
          setMessage({ type: 'error', text: 'Failed to load users. Please try again.' });
          setLoadingUsers(false);
        });
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const points = parseInt(deltaPoints, 10);
    const result = await adjustUserPoints(selectedUserId, points, reason);

    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Points adjusted successfully!' });
      // Reset form
      setDeltaPoints('');
      setReason('');
      setTimeout(() => setMessage(null), 5000);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to adjust points' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Select User {!isDevMode && users.length > 0 && (
                <span className="text-xs font-normal text-gray-500">
                  ({users.length} {users.length === 1 ? 'user' : 'users'} available)
                </span>
              )}
            </label>
            {!isDevMode && (
              <button
                type="button"
                onClick={loadUsers}
                disabled={loadingUsers}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                {loadingUsers ? 'Loading...' : '↻ Refresh'}
              </button>
            )}
          </div>
          <select
            value={selectedUserId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedUserId(e.target.value)}
            disabled={isDevMode || loading || loadingUsers}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
          >
            <option value="" className="text-gray-500">
              {loadingUsers 
                ? 'Loading users...' 
                : users.length === 0 
                  ? 'No users found' 
                  : 'Select a user...'}
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
                {user.full_name ? ` - ${user.full_name}` : ''}
                {user.role === 'admin' ? ' [Admin]' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Input
            label="Points Adjustment"
            type="number"
            value={deltaPoints}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeltaPoints(e.target.value)}
            disabled={isDevMode || loading}
            placeholder="e.g., 100 or -50"
            required
          />
          <p className="text-xs text-gray-700 mt-1">
            Use positive numbers to add points, negative to deduct
          </p>
        </div>
      </div>

      <div>
        <Input
          label="Reason"
          type="text"
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
          disabled={isDevMode || loading}
          placeholder="e.g., Monthly bonus, Order correction"
          required
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          disabled={isDevMode || loading || !selectedUserId || !deltaPoints || !reason}
        >
          {loading ? 'Adjusting...' : 'Adjust Points'}
        </Button>
      </div>

      {isDevMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Configure Supabase to enable admin actions. See SETUP.txt for instructions.
          </p>
        </div>
      )}

      {message && (
        <div
          className={`rounded-md p-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}
    </form>
  );
}

