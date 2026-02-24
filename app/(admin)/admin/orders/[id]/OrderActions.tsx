'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { deleteOrder, refundOrder } from '../actions';

interface OrderActionsProps {
  orderId: string;
  isDevMode: boolean;
  isAlreadyRefunded?: boolean;
}

export function OrderActions({
  orderId,
  isDevMode,
  isAlreadyRefunded = false,
}: OrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'delete' | 'refund' | 'refund-return' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState<'refund' | 'refund-return' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setMessage(null);
      return;
    }
    setLoading('delete');
    setMessage(null);
    const result = await deleteOrder(orderId);
    setLoading(null);
    setConfirmDelete(false);
    if (result.success) {
      setMessage({ type: 'success', text: 'Order deleted. Redirecting...' });
      router.push('/admin/orders');
      router.refresh();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to delete order' });
    }
  };

  const handleRefund = async (withReturn: boolean) => {
    setLoading(withReturn ? 'refund-return' : 'refund');
    setMessage(null);
    const result = await refundOrder(orderId, { withReturn });
    setLoading(null);
    setConfirmRefund(null);
    if (result.success) {
      setMessage({ type: 'success', text: withReturn ? 'Refund with return completed.' : 'Refund completed.' });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to refund order' });
    }
  };

  if (isDevMode) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant="outline"
          className="border-red-300 text-red-800 bg-white hover:bg-red-50 hover:border-red-400"
          onClick={handleDelete}
          disabled={loading !== null}
        >
          {confirmDelete ? (loading === 'delete' ? 'Processing...' : 'Yes, Delete Order') : 'Delete'}
        </Button>
        {confirmDelete && (
          <Button
            variant="outline"
            className="border-gray-300 text-gray-900"
            onClick={() => {
              setConfirmDelete(false);
              setMessage(null);
            }}
            disabled={loading !== null}
          >
            Cancel
          </Button>
        )}
        {!isAlreadyRefunded && (
          <>
            {confirmRefund === null ? (
              <Button
                variant="outline"
                className="border-gray-300 text-gray-900"
                onClick={() => setConfirmRefund('refund')}
                disabled={loading !== null}
              >
                Refund
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  className="border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100 hover:border-amber-500"
                  onClick={() => handleRefund(false)}
                  disabled={loading !== null}
                >
                  {loading === 'refund' ? 'Processing...' : 'Refund only'}
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-500 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-600"
                  onClick={() => handleRefund(true)}
                  disabled={loading !== null}
                >
                  {loading === 'refund-return' ? 'Processing...' : 'Refund with return'}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRefund(null);
                    setMessage(null);
                  }}
                  disabled={loading !== null}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-200"
                >
                  ← Back
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
