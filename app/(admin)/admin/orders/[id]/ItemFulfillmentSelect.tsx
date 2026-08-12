'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateItemFulfillment } from '../actions';
import {
  ITEM_FULFILLMENT_STATUSES,
  ITEM_FULFILLMENT_LABELS,
  type ItemFulfillmentStatus,
} from '@/lib/orders/fulfillment';

interface ItemFulfillmentSelectProps {
  orderId: string;
  itemId: string;
  currentStatus: string;
  disabled?: boolean;
}

export function ItemFulfillmentSelect({
  orderId,
  itemId,
  currentStatus,
  disabled,
}: ItemFulfillmentSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Held locally so the dropdown responds immediately; the server is the source of truth
  // and a rejected write snaps it back rather than leaving a lie on screen.
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (next: string) => {
    const previous = status;
    setStatus(next);
    setError(null);

    const result = await updateItemFulfillment({ orderId, itemId, status: next });

    if (!result.success) {
      setStatus(previous);
      setError(result.error || 'Failed to update');
      return;
    }

    startTransition(() => router.refresh());
  };

  return (
    <div>
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled || isPending}
        aria-label="Item fulfillment status"
        className="w-full min-w-[9rem] px-2 py-1 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {ITEM_FULFILLMENT_STATUSES.map((value: ItemFulfillmentStatus) => (
          <option key={value} value={value}>
            {ITEM_FULFILLMENT_LABELS[value]}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
