'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { refundOrderItem } from '../actions';

interface ItemRefundButtonProps {
  orderId: string;
  itemId: string;
  points: number;
  /**
   * The line took units off the shelf (at checkout, or when a made-to-order line was marked
   * ready), so a refund with return has something to put back. A made-to-order item that
   * never arrived has nothing, and offering "with return" there only invites a wrong click.
   */
  canReturnStock: boolean;
}

export function ItemRefundButton({ orderId, itemId, points, canReturnStock }: ItemRefundButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState<'refund' | 'refund-return' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefund = async (withReturn: boolean) => {
    setLoading(withReturn ? 'refund-return' : 'refund');
    setError(null);

    const result = await refundOrderItem(orderId, itemId, { withReturn });

    setLoading(null);

    if (!result.success) {
      setError(result.error || 'Failed to refund the item');
      return;
    }

    setConfirming(false);
    router.refresh();
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setConfirming(true);
          setError(null);
        }}
        className="mt-1 text-xs font-medium text-gray-700 underline hover:text-gray-900"
      >
        Refund item
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs text-gray-800">
        Give back {points.toLocaleString()} pts for this item?
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => handleRefund(false)}
          disabled={loading !== null}
          className="px-2 py-1 text-xs font-medium rounded-md border border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-60"
        >
          {loading === 'refund' ? 'Processing...' : canReturnStock ? 'Refund only' : 'Refund'}
        </button>
        {canReturnStock && (
          <button
            type="button"
            onClick={() => handleRefund(true)}
            disabled={loading !== null}
            className="px-2 py-1 text-xs font-medium rounded-md border border-emerald-500 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60"
          >
            {loading === 'refund-return' ? 'Processing...' : 'Refund with return'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={loading !== null}
          className="px-2 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100"
        >
          Back
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
