'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { submitAccessRequest } from './actions';

export default function RequestAccessPage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await submitAccessRequest({
        email,
        fullName,
        message: message || undefined,
      });

      if (result.success) {
        setSuccess(result.message || 'Access request submitted successfully!');
        // Clear form
        setEmail('');
        setFullName('');
        setMessage('');
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          router.push('/home');
        }, 3000);
      } else {
        setError(result.error || 'Failed to submit access request');
      }
    } catch (err) {
      console.error('Request access error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Request Access
          </h1>
          <p className="text-gray-600">
            Fill out the form below to request access to CBM Plastics Rewards. Our team will review your request and send you login instructions via email.
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Access Request Form</h2>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                <p className="font-medium mb-1">Success!</p>
                <p className="text-sm">{success}</p>
                <p className="text-sm mt-2">Redirecting to homepage...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Work Email"
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  disabled={loading}
                />

                <Input
                  label="Full Name"
                  type="text"
                  value={fullName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="John Doe"
                  disabled={loading}
                />

                <div className="w-full">
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Message (Optional)
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Tell us a bit about why you'd like access..."
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-600"
                  />
                  {message.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500 text-right">
                      {message.length} / 1000 characters
                    </p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </Button>

                <div className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <a href="/login" className="text-primary hover:underline font-medium">
                    Login here
                  </a>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

