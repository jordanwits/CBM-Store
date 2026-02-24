'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { UsersTableClient } from './UsersTableClient';
import { CreateUserModal } from './CreateUserModal';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
  active: boolean;
  created_at: string;
  points_balance: number;
};

type AccessRequest = {
  id: string;
  email: string;
  full_name: string;
  message: string | null;
  status: string;
  created_at: string;
};

interface UsersPageClientProps {
  isDevMode: boolean;
  users: UserRow[];
  accessRequests: AccessRequest[];
  currentAdminId?: string;
}

export function UsersPageClient({ isDevMode, users, accessRequests, currentAdminId }: UsersPageClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [initialFormData, setInitialFormData] = useState<{ email?: string; fullName?: string } | null>(null);

  return (
    <div>
      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setInitialFormData(null);
        }}
        isDevMode={isDevMode}
        initialEmail={initialFormData?.email}
        initialFullName={initialFormData?.fullName}
      />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setInitialFormData(null);
            setIsCreateModalOpen(true);
          }}
          disabled={isDevMode}
          className="w-full sm:w-auto shrink-0"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </Button>
      </div>

      {/* Pending Access Requests */}
      {accessRequests && accessRequests.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Access Requests ({accessRequests.length})
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accessRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => {
                    setInitialFormData({
                      email: request.email,
                      fullName: request.full_name,
                    });
                    setIsCreateModalOpen(true);
                  }}
                  className="p-4 border border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">{request.full_name}</p>
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                          Pending
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{request.email}</p>
                      {request.message && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{request.message}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Requested {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 shrink-0 mt-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <UsersTableClient
              isDevMode={isDevMode}
              users={users}
              currentAdminId={currentAdminId}
              hideAddButton={true}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">
              {isDevMode ? 'Mock users shown (configure Supabase to see real data)' : 'No users found'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

