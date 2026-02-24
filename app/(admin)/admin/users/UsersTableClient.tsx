'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Alert } from 'core/components/Alert';
import { setUserActive, updateUserProfile, deleteUser } from './actions';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  active: boolean;
  created_at: string;
  points_balance: number;
};

function UserRowActions({
  user,
  onEdit,
  onToggleActive,
  onDelete,
  disabled,
  disableDeactivate,
  disableDelete,
}: {
  user: UserRow;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  disabled: boolean;
  disableDeactivate: boolean;
  disableDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && triggerRef.current && typeof document !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 160;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight && rect.top > spaceBelow;
      setMenuPosition({
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top : undefined,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 180)),
      });
    } else {
      setMenuPosition(null);
    }
  }, [open]);

  const menuContent = open && menuPosition && typeof document !== 'undefined' ? (
    <div
      ref={menuRef}
      className="fixed py-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
      style={{
        ...(menuPosition.top !== undefined && { top: menuPosition.top }),
        ...(menuPosition.bottom !== undefined && { bottom: menuPosition.bottom }),
        left: menuPosition.left,
      }}
    >
      <button
        type="button"
        onClick={() => {
          onEdit();
          setOpen(false);
        }}
        disabled={disabled}
        className="w-full px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          onToggleActive();
          setOpen(false);
        }}
        disabled={disabled || disableDeactivate}
        title={disableDeactivate ? 'You cannot deactivate your own account' : undefined}
        className="w-full px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {user.active ? 'Deactivate' : 'Activate'}
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete();
          setOpen(false);
        }}
        disabled={disabled || disableDelete}
        title={disableDelete ? 'You cannot delete your own account' : undefined}
        className="w-full px-3 py-2 text-left text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Delete
      </button>
    </div>
  ) : null;

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={disabled}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="User actions"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>
      {menuContent && createPortal(menuContent, document.body)}
    </div>
  );
}

export function UsersTableClient({
  isDevMode,
  users,
  currentAdminId,
  hideAddButton = false,
  onAddUser,
}: {
  isDevMode: boolean;
  users: UserRow[];
  currentAdminId?: string;
  hideAddButton?: boolean;
  onAddUser?: () => void;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [draftFullName, setDraftFullName] = useState('');
  const [draftRole, setDraftRole] = useState<'user' | 'admin'>('user');

  const filteredAndSortedUsers = useMemo(() => {
    // Filter by search query first
    let filtered = users;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = users.filter(
        (u) =>
          u.email.toLowerCase().includes(query) ||
          u.full_name?.toLowerCase().includes(query)
      );
    }

    // Keep consistent ordering; show current admin at top for clarity
    const arr = [...filtered];
    if (currentAdminId) {
      arr.sort((a, b) => {
        if (a.id === currentAdminId) return -1;
        if (b.id === currentAdminId) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [users, currentAdminId, searchQuery]);

  const startEdit = (u: UserRow) => {
    setMessage(null);
    setEditingId(u.id);
    setDraftFullName(u.full_name || '');
    setDraftRole(u.role);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftFullName('');
    setDraftRole('user');
    setMessage(null);
  };

  const saveEdit = async (userId: string) => {
    setMessage(null);
    setSaving(true);
    try {
      const result = await updateUserProfile({
        userId,
        fullName: draftFullName,
        role: draftRole,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'User updated.' });
        setEditingId(null);
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update user.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Unexpected error updating user.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    setMessage(null);

    if (!u.active) {
      // activating is safe
    } else {
      const ok = confirm(`Deactivate ${u.email}? They will not be able to log in.`);
      if (!ok) return;
    }

    setSaving(true);
    try {
      const result = await setUserActive({ userId: u.id, active: !u.active });
      if (result.success) {
        setMessage({ type: 'success', text: `User ${!u.active ? 'activated' : 'deactivated'}.` });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update user status.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Unexpected error updating user status.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: UserRow) => {
    setMessage(null);

    const ok = confirm(
      `Are you sure you want to permanently delete ${u.email}?\n\nThis action cannot be undone. All user data will be removed.`
    );
    if (!ok) return;

    setSaving(true);
    try {
      const result = await deleteUser({ userId: u.id });
      if (result.success) {
        setMessage({ type: 'success', text: 'User deleted successfully.' });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete user.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Unexpected error deleting user.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {isDevMode && (
        <Alert variant="warning">
          <strong>Dev Mode:</strong> Configure Supabase to enable user management actions.
        </Alert>
      )}

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
      )}

      {/* Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="w-full sm:w-96">
          <Input
            type="search"
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        {!hideAddButton && onAddUser && (
          <Button
            variant="primary"
            onClick={onAddUser}
            disabled={isDevMode}
            className="whitespace-nowrap"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </Button>
        )}
      </div>

      {filteredAndSortedUsers.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          {searchQuery.trim() ? (
            <>No users found matching &quot;{searchQuery}&quot;</>
          ) : (
            'No users found'
          )}
        </div>
      ) : (
        <>
        {/* Mobile card layout - hidden on md+ */}
        <div className="md:hidden space-y-4">
          {filteredAndSortedUsers.map((u) => {
            const isSelf = currentAdminId ? u.id === currentAdminId : false;
            const isEditing = editingId === u.id;
            const disableActions = isDevMode || saving;
            const disableSelfDeactivate = isSelf && u.active;
            const disableSelfDemote = isSelf && u.role === 'admin';

            return (
              <div className="p-4 rounded-lg border border-gray-200 bg-white" key={u.id}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSelf && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900">
                        You
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        u.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-500">Name: </span>
                    {isEditing ? (
                      <Input
                        value={draftFullName}
                        onChange={(e) => setDraftFullName(e.target.value)}
                        disabled={disableActions}
                        placeholder="Full name"
                        className="mt-1 w-full"
                      />
                    ) : (
                      <span className="text-gray-900">{u.full_name || '-'}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Role: </span>
                    {isEditing ? (
                      <select
                        value={draftRole}
                        onChange={(e) => setDraftRole(e.target.value as 'user' | 'admin')}
                        disabled={disableActions || disableSelfDemote}
                        className="mt-1 w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        title={disableSelfDemote ? 'You cannot remove your own admin role' : undefined}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {u.role}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Points Balance: </span>
                    <span className="text-gray-900 font-semibold">
                      {isDevMode ? '-' : u.points_balance.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">
                    Created {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                  {!isEditing ? (
                    <UserRowActions
                      user={u}
                      onEdit={() => startEdit(u)}
                      onToggleActive={() => toggleActive(u)}
                      onDelete={() => handleDelete(u)}
                      disabled={disableActions}
                      disableDeactivate={u.active && disableSelfDeactivate}
                      disableDelete={isSelf}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => saveEdit(u.id)}
                        disabled={disableActions}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={disableActions}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table - hidden on mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                  Full Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                  Points Balance
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredAndSortedUsers.map((u) => {
                const isSelf = currentAdminId ? u.id === currentAdminId : false;
                const isEditing = editingId === u.id;
                const disableActions = isDevMode || saving;
                const disableSelfDeactivate = isSelf && u.active;
                const disableSelfDemote = isSelf && u.role === 'admin';

                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{u.email}</span>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-900">
                            You
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">
                      {isEditing ? (
                        <Input
                          value={draftFullName}
                          onChange={(e) => setDraftFullName(e.target.value)}
                          disabled={disableActions}
                          placeholder="Full name"
                          className="max-w-sm"
                        />
                      ) : (
                        <span>{u.full_name || '-'}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <select
                          value={draftRole}
                          onChange={(e) => setDraftRole(e.target.value as 'user' | 'admin')}
                          disabled={disableActions || disableSelfDemote}
                          className="px-3 py-2 border border-gray-400 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                          title={disableSelfDemote ? 'You cannot remove your own admin role' : undefined}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {isDevMode ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <span className="font-semibold">{u.points_balance.toLocaleString()}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          u.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      {!isEditing ? (
                        <UserRowActions
                          user={u}
                          onEdit={() => startEdit(u)}
                          onToggleActive={() => toggleActive(u)}
                          onDelete={() => handleDelete(u)}
                          disabled={disableActions}
                          disableDeactivate={u.active && disableSelfDeactivate}
                          disableDelete={isSelf}
                        />
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => saveEdit(u.id)}
                            disabled={disableActions}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={disableActions}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {filteredAndSortedUsers.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Showing {filteredAndSortedUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}


