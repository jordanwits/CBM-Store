'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Alert } from 'core/components/Alert';
import { createUser } from './actions';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDevMode: boolean;
  initialEmail?: string;
  initialFullName?: string;
}

export function CreateUserModal({ isOpen, onClose, isDevMode, initialEmail, initialFullName }: CreateUserModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastResult, setLastResult] = useState<{ emailSent?: boolean; emailError?: string } | null>(null);

  // Update form when initial values change (e.g., when clicking an access request)
  useEffect(() => {
    if (isOpen) {
      if (initialEmail) {
        setEmail(initialEmail);
      }
      if (initialFullName) {
        setFullName(initialFullName);
      }
    }
  }, [isOpen, initialEmail, initialFullName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLastResult(null);
    setLoading(true);

    const result = await createUser({
      email: email.trim(),
      fullName: fullName.trim() || undefined,
      role,
    });

    setLoading(false);

    if (result.success) {
      setLastResult({ emailSent: result.emailSent, emailError: result.emailError });
      setSuccess(true);
      // Reset form
      setEmail('');
      setFullName('');
      setRole('user');
      // Refresh and close after a brief delay
      setTimeout(() => {
        router.refresh();
        onClose();
        setSuccess(false);
        setLastResult(null);
      }, 1500);
    } else {
      setError(result.error || 'Failed to create user');
    }
  };

  const handleClose = () => {
    if (loading) return;
    setEmail('');
    setFullName('');
    setRole('user');
    setError(null);
    setSuccess(false);
    setLastResult(null);
    onClose();
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setFullName('');
      setRole('user');
      setError(null);
      setSuccess(false);
      setLastResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {initialEmail ? 'Approve Access Request' : 'Add New User'}
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isDevMode && (
          <Alert variant="warning" className="mb-4">
            <p className="text-xs">
              <strong>Dev Mode:</strong> User creation requires Supabase configuration
            </p>
          </Alert>
        )}

        {success && (
          <Alert variant={lastResult?.emailSent === false ? 'warning' : 'success'} className="mb-4">
            <p className="text-sm">
              {lastResult?.emailSent === false ? (
                <>
                  <strong>User created, but the invitation email could not be sent.</strong>{' '}
                  {lastResult?.emailError ? `(${lastResult.emailError}) ` : ''}
                  You may need to share the login link with them manually or check that RESEND_API_KEY and FROM_EMAIL are set in your deployment environment.
                </>
              ) : (
                <>
                  <strong>User invited successfully!</strong> An invitation email has been sent with a link to set their password.
                </>
              )}
            </p>
          </Alert>
        )}

        {error && (
          <Alert variant="error" className="mb-4">
            <p className="text-sm">{error}</p>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            disabled={loading || isDevMode}
          />

          <Input
            label="Full Name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            disabled={loading || isDevMode}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
              disabled={loading || isDevMode}
              className="w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="pt-4 border-t space-y-3">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading || isDevMode || !email.trim()}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create User'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>

          <div className="text-xs text-gray-600 bg-gray-50 rounded-md p-3">
            <p className="font-semibold mb-1">Note:</p>
            <p>The new user will receive an invitation email with a link to set their password. The invitation link is valid for 24 hours.</p>
          </div>
        </form>
      </div>
    </div>
  );
}

