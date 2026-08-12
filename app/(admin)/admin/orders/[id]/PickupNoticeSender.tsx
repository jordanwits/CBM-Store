'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { sendPickupNotice } from '../actions';

export interface PickupNoticeLine {
  id: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  /** Units still to be made for this line; 0 means it is on the shelf. */
  unitsToMake: number;
  fulfillmentStatus: string;
}

/**
 * What to tick before staff touch anything: lines already marked ready, plus pending lines
 * with nothing left to make. Collected lines start unticked — the customer has those, and
 * this notice is about what they can come and get.
 */
function defaultsToReady(line: PickupNoticeLine): boolean {
  if (line.fulfillmentStatus === 'picked_up') return false;
  return line.fulfillmentStatus === 'ready' || line.unitsToMake === 0;
}

interface PickupNoticeSenderProps {
  orderId: string;
  lines: PickupNoticeLine[];
  isDevMode: boolean;
}

export function PickupNoticeSender({ orderId, lines, isDevMode }: PickupNoticeSenderProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // For the common case — one made-to-order line holding up an otherwise complete order —
  // the defaults are already right and sending is one click.
  const [readyIds, setReadyIds] = useState<Set<string>>(
    () => new Set(lines.filter(defaultsToReady).map((line) => line.id))
  );
  const [note, setNote] = useState('');

  const readyLines = lines.filter((line) => readyIds.has(line.id));
  // Mirrors the server: a collected line is not outstanding, so it is not "still coming".
  const pendingLines = lines.filter(
    (line) => !readyIds.has(line.id) && line.fulfillmentStatus !== 'picked_up'
  );

  const toggle = (id: string) => {
    setReadyIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSend = async () => {
    setMessage(null);
    setLoading(true);

    const result = await sendPickupNotice({
      orderId,
      readyItemIds: Array.from(readyIds),
      note: note.trim() || undefined,
    });

    setLoading(false);

    if (!result.success) {
      setMessage({ type: 'error', text: result.error || 'Failed to send the pickup notice.' });
      return;
    }

    if (result.warning) {
      setMessage({ type: 'warning', text: result.warning });
      setIsEditing(false);
      router.refresh();
      return;
    }

    setMessage({
      type: 'success',
      text:
        pendingLines.length > 0
          ? `Emailed the customer that ${readyLines.length} of ${lines.length} lines are ready, and marked them ready.`
          : 'Emailed the customer that their order is ready for pickup.',
    });
    setIsEditing(false);
    setNote('');
    router.refresh();
  };

  const handleCancel = () => {
    setReadyIds(new Set(lines.filter(defaultsToReady).map((line) => line.id)));
    setNote('');
    setIsEditing(false);
    setMessage(null);
  };

  const messageClasses: Record<'success' | 'error' | 'warning', string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
  };

  if (!isEditing) {
    return (
      <div className="space-y-3">
        <p className="text-gray-800">
          Tell the customer which items they can collect now. The items you pick are marked
          ready, and the order status is left alone — so an order can be collected in stages
          while it stays flagged as outstanding.
        </p>
        <Button variant="primary" onClick={() => setIsEditing(true)} disabled={isDevMode}>
          Send pickup notice
        </Button>
        {message && (
          <div className={`rounded-md border p-3 ${messageClasses[message.type]}`}>
            <p className="text-sm">{message.text}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Ready for pickup now</p>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {lines.map((line) => (
            <li key={line.id}>
              <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={readyIds.has(line.id)}
                  onChange={() => toggle(line.id)}
                  disabled={loading}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">
                  <span className="font-medium text-gray-900">{line.productName}</span>
                  <span className="text-gray-700"> &times; {line.quantity}</span>
                  {line.variantLabel && (
                    <span className="block text-xs text-gray-600 mt-0.5">{line.variantLabel}</span>
                  )}
                  {line.fulfillmentStatus === 'picked_up' && (
                    <span className="block text-xs text-green-700 mt-0.5">
                      Already picked up
                    </span>
                  )}
                  {line.fulfillmentStatus !== 'picked_up' && line.unitsToMake > 0 && (
                    <span className="block text-xs text-amber-700 mt-0.5">
                      {line.unitsToMake} still to be made
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Note to the customer (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading}
          rows={3}
          placeholder="e.g. This is the remaining item from your order — sorry for the wait!"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-800">
        {readyLines.length === 0 ? (
          <span className="text-red-700">Select at least one item that is ready.</span>
        ) : pendingLines.length > 0 ? (
          <>
            The email will say <strong>{readyLines.length}</strong>{' '}
            {readyLines.length === 1 ? 'line is' : 'lines are'} ready to collect and{' '}
            <strong>{pendingLines.length}</strong>{' '}
            {pendingLines.length === 1 ? 'is' : 'are'} still coming.
          </>
        ) : (
          <>The email will say the whole order is ready to collect.</>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={handleSend}
          disabled={loading || readyLines.length === 0}
        >
          {loading ? 'Sending...' : 'Send email'}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
      </div>

      {message && (
        <div className={`rounded-md border p-3 ${messageClasses[message.type]}`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}
    </div>
  );
}
