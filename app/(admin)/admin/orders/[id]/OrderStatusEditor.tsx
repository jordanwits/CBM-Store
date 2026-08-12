'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { updateOrderStatus } from '../actions';
import { ORDER_STATUS_OPTIONS } from '@/lib/orders/status';

interface OrderStatusEditorProps {
  orderId: string;
  currentStatus: string;
  currentTrackingNumber?: string;
  currentNotes?: string;
  isDevMode: boolean;
}

const STATUS_OPTIONS = ORDER_STATUS_OPTIONS;

export function OrderStatusEditor({ 
  orderId, 
  currentStatus, 
  currentTrackingNumber, 
  currentNotes, 
  isDevMode 
}: OrderStatusEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [status, setStatus] = useState(currentStatus);
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber || '');
  const [notes, setNotes] = useState(currentNotes || '');
  // Null until staff touch the box: the default follows the dropdown, so picking a new
  // status arms the email and fixing a note leaves it disarmed, without overriding a
  // deliberate choice made before the status was changed.
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
      trackingNumber: trackingNumber || undefined,
      notes: notes || undefined,
      notifyCustomer,
    });

    setLoading(false);

    if (result.success) {
      setMessage({
        type: 'success',
        text: notifyCustomer
          ? 'Order updated and the customer has been emailed.'
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
    setNotes(currentNotes || '');
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
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Tracking Number (Optional)"
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          disabled={loading}
          placeholder="e.g., 1Z999AA10123456784"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Internal Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            placeholder="Add any internal notes about this order..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

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
