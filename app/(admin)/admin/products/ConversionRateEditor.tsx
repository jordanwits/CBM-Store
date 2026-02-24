'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { updateConversionRate } from './actions';

interface ConversionRateEditorProps {
  currentRate: number;
  isDevMode: boolean;
}

export default function ConversionRateEditor({ currentRate, isDevMode }: ConversionRateEditorProps) {
  const [rate, setRate] = useState(currentRate.toString());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const numRate = parseFloat(rate);
    const result = await updateConversionRate(numRate);

    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Conversion rate updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update conversion rate' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            USD to Points Conversion Rate
          </label>
          <div className="flex items-center gap-3">
            <span className="text-gray-600">$1 =</span>
            <Input
              type="number"
              value={rate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRate(e.target.value)}
              min="0.01"
              step="0.01"
              disabled={isDevMode || loading}
              className="w-32"
              required
            />
            <span className="text-gray-600">points</span>
          </div>
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            variant="primary"
            disabled={isDevMode || loading}
            className="w-full md:w-auto"
          >
            {loading ? 'Saving...' : 'Update Rate'}
          </Button>
        </div>
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

      <div className="text-xs text-gray-700">
        <p>This rate is applied globally to all products. Current display: ${1} = {currentRate} points</p>
      </div>
    </form>
  );
}

