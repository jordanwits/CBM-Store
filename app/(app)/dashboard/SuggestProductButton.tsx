'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Alert } from 'core/components/Alert';
import { submitProductSuggestion } from './suggest-product-actions';

interface SuggestProductButtonProps {
  isDevMode: boolean;
  className?: string;
}

export function SuggestProductButton({ isDevMode, className = '' }: SuggestProductButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    if (loading) return;
    setOpen(false);
    setText('');
    setError(null);
    setDone(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await submitProductSuggestion(text);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Something went wrong.');
      return;
    }
    setDone(true);
    setText('');
    window.setTimeout(() => {
      close();
    }, 1200);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm font-medium text-secondary hover:text-secondary/80 underline-offset-2 hover:underline ${className}`}
      >
        Suggest a product
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Suggest a product</h2>
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isDevMode && (
              <Alert variant="warning" className="mb-4">
                <p className="text-xs">Dev mode: suggestions are not saved without Supabase.</p>
              </Alert>
            )}

            {done && (
              <Alert variant="success" className="mb-4">
                <p className="text-sm">Thanks — we emailed your suggestion to the store admins.</p>
              </Alert>
            )}

            {error && (
              <Alert variant="error" className="mb-4">
                <p className="text-sm">{error}</p>
              </Alert>
            )}

            {!done && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="product-suggestion" className="block text-sm font-medium text-gray-700 mb-1">
                    What should we add?
                  </label>
                  <textarea
                    id="product-suggestion"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. branded fleece jacket, navy"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm resize-y min-h-[88px]"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">{text.length} / 500</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={close} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={loading || !text.trim()}>
                    {loading ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
