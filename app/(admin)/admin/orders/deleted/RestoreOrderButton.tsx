'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { restoreDeletedOrder } from '../actions';

interface RestoreOrderButtonProps {
  orderId: string;
}

export function RestoreOrderButton({ orderId }: RestoreOrderButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!confirming) {
      setConfirming(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await restoreDeletedOrder(orderId);

    setLoading(false);
    setConfirming(false);

    if (!result.success) {
      setError(result.error || 'Failed to restore the order');
      return;
    }

    // Straight to the order, so staff can see it came back whole
    router.push(`/admin/orders/${orderId}`);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={handleRestore} disabled={loading}>
          {loading ? 'Restoring...' : confirming ? 'Yes, restore' : 'Restore'}
        </Button>
        {confirming && !loading && (
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-700 max-w-xs">{error}</p>}
    </div>
  );
}
