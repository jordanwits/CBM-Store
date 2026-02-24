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
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
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
  const [addressLine1, setAddressLine1] = useState(initialProfile?.address_line1 || '');
  const [addressLine2, setAddressLine2] = useState(initialProfile?.address_line2 || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [state, setState] = useState(initialProfile?.state || '');
  const [zip, setZip] = useState(initialProfile?.zip || '');
  const [country, setCountry] = useState(initialProfile?.country || 'US');

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
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        country: country.trim() || undefined,
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
      {/* Message */}
      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
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
                label="Full Name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Default Shipping Address</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                id="addressLine1"
                label="Address Line 1"
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="123 Main St"
              />
            </div>

            <div>
              <Input
                id="addressLine2"
                label="Address Line 2 (Optional)"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apt 4B"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  id="city"
                  label="City"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="New York"
                />
              </div>

              <div>
                <Input
                  id="state"
                  label="State/Province"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="NY"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  id="zip"
                  label="ZIP/Postal Code"
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="10001"
                />
              </div>

              <div>
                <Input
                  id="country"
                  label="Country"
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="US"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFullName(initialProfile.full_name || '');
              setAddressLine1(initialProfile.address_line1 || '');
              setAddressLine2(initialProfile.address_line2 || '');
              setCity(initialProfile.city || '');
              setState(initialProfile.state || '');
              setZip(initialProfile.zip || '');
              setCountry(initialProfile.country || 'US');
              setMessage(null);
            }}
            disabled={isPending}
          >
            Reset
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

