'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from 'core/components/Input';
import { Button } from 'core/components/Button';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Alert } from 'core/components/Alert';
import { updateProfile, UpdateProfileResult } from './actions';

interface ProfilePageClientProps {
  isDevMode: boolean;
  initialProfile: {
    full_name: string | null;
    email: string;
  } | null;
}

export default function ProfilePageClient({
  isDevMode,
  initialProfile,
}: ProfilePageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fullName, setFullName] = useState(initialProfile?.full_name || '');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);

    if (isDevMode) {
      setMessage({ type: 'error', text: 'Profile updates require Supabase to be configured.' });
      return;
    }

    startTransition(async () => {
      const result: UpdateProfileResult = await updateProfile({
        fullName: fullName.trim() || undefined,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        router.refresh();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update profile.' });
      }
    });
  };

  if (!initialProfile) {
    return (
      <p className="text-gray-600">Unable to load profile. Please try again later.</p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Personal information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={initialProfile.email}
                disabled
                className="bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <Input
                id="fullName"
                label="Full name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFullName(initialProfile.full_name || '');
              setMessage(null);
            }}
            disabled={isPending}
          >
            Reset
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
