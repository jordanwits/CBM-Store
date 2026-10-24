'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { updateOrderStatus } from '../actions';
import { ORDER_STATUS_OPTIONS, statusChangeBlockedReason } from '@/lib/orders/status';

interface OrderStatusEditorProps {
  orderId: string;
  currentStatus: string;
  currentTrackingNumber?: string;
  /** Points the order could still give back, and whether every point already has */
  refunds: { left: number; isFullyRefunded: boolean };
  isDevMode: boolean;
}

const STATUS_OPTIONS = ORDER_STATUS_OPTIONS;

// The page renders this with a key built from the order's status and reference, so after
// router.refresh() (a refund, a pickup notice, this save) it starts again from the stored
// values rather than keeping what it was first given.
export function OrderStatusEditor({
  orderId,
  currentStatus,
  currentTrackingNumber,
  refunds,
  isDevMode
}: OrderStatusEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [status, setStatus] = useState(currentStatus);
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber || '');
  // Null until staff touch the box: the default follows the dropdown, so picking a new
  // status arms the email and fixing a tracking number leaves it disarmed, without
  // overriding a deliberate choice made before the status was changed.
  const [notifyOverride, setNotifyOverride] = useState<boolean | null>(null);

  const statusChanged = status !== currentStatus;
  const notifyCustomer = notifyOverride ?? statusChanged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const result = await updateOrderStatus({
      orderId,
      status,
      // Always sent, so emptying the box clears the reference (the action stores '' as null)
      trackingNumber: trackingNumber.trim(),
      notifyCustomer,
    });

    setLoading(false);

    if (result.success) {
      setMessage({
        type: 'success',
        // The server says whether an email actually went: a phone-only customer has no
        // real address, so asking for one is not the same as sending one
        text: result.customerEmailed
          ? 'Order updated and the customer has been emailed.'
          : result.emailNotConfigured
            ? 'Order updated, but email is not set up for this store (RESEND_API_KEY and FROM_EMAIL), so the customer was not emailed.'
          : notifyCustomer
            ? 'Order updated. This customer has no email address on file, so they were not emailed.'
            : 'Order updated. No email was sent to the customer.',
      });
      setIsEditing(false);
      setNotifyOverride(null);
      setTimeout(() => {
        router.refresh();
      }, 500);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update order' });
    }
  };

  const handleCancel = () => {
    setStatus(currentStatus);
    setTrackingNumber(currentTrackingNumber || '');
    setNotifyOverride(null);
    setIsEditing(false);
    setMessage(null);
  };

  if (!isEditing) {
    return (
      <Button 
        variant="primary" 
        onClick={() => setIsEditing(true)}
        disabled={isDevMode}
      >
        Update Status
      </Button>
    );
  }

  return (
    <div className="bg-white border-2 border-primary/20 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Order Status</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {STATUS_OPTIONS.map((option) => {
              const blocked = statusChangeBlockedReason(currentStatus, option.value, refunds);
              return (
                <option key={option.value} value={option.value} disabled={blocked !== null}>
                  {option.label}
                  {blocked && option.value === 'cancelled' ? ' (use Refund)' : ''}
                </option>
              );
            })}
          </select>
          {refunds.isFullyRefunded ? (
            <p className="text-xs text-gray-600 mt-1">
              Every point on this order has been refunded, so it stays cancelled.
            </p>
          ) : refunds.left > 0 && currentStatus !== 'cancelled' ? (
            <p className="text-xs text-gray-600 mt-1">
              To cancel, use Refund: it gives the points back and asks about the stock.
            </p>
          ) : null}
        </div>

        <Input
          label="Tracking Number (Optional)"
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          disabled={loading}
          placeholder="e.g., 1Z999AA10123456784"
        />

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyCustomer}
              onChange={(e) => setNotifyOverride(e.target.checked)}
              disabled={loading}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800">
              <span className="font-medium">Email the customer about this update</span>
              <span className="block text-xs text-gray-600 mt-0.5">
                {statusChanged
                  ? 'They will get the standard status email for the whole order.'
                  : 'The status has not changed, so this is off by default. Use “Send pickup notice” below to tell them about specific items.'}
              </span>
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>

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
      </form>
    </div>
  );
}
