'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteOrder, refundOrder } from './actions';

interface OrderListActionsProps {
  orderId: string;
  isDevMode: boolean;
}

export function OrderListActions({ orderId, isDevMode }: OrderListActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<'delete' | 'refund' | 'refund-return' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState<'refund' | 'refund-return' | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
        setConfirmDelete(false);
        setConfirmRefund(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && triggerRef.current && typeof document !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight && rect.top > spaceBelow;
      setMenuPosition({
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top : undefined,
        left: rect.right - 256,
      });
    } else {
      setMenuPosition(null);
    }
  }, [open]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading('delete');
    const result = await deleteOrder(orderId);
    setLoading(null);
    setOpen(false);
    setConfirmDelete(false);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete order');
    }
  };

  const handleRefund = async (e: React.MouseEvent, withReturn: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(withReturn ? 'refund-return' : 'refund');
    const result = await refundOrder(orderId, { withReturn });
    setLoading(null);
    setOpen(false);
    setConfirmRefund(null);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to refund order');
    }
  };

  if (isDevMode) {
    return (
      <Link href={`/admin/orders/${orderId}`} className="text-primary font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        View
      </Link>
    );
  }

  return (
    <div className="relative flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Link href={`/admin/orders/${orderId}`} className="text-primary font-medium hover:underline">
        View
      </Link>
      <span className="text-gray-300">|</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
          setConfirmDelete(false);
          setConfirmRefund(null);
        }}
        className="p-1 rounded hover:bg-gray-100 text-gray-600"
        aria-label="Order actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>
      {open && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed py-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          style={{
            ...(menuPosition.top !== undefined && { top: menuPosition.top }),
            ...(menuPosition.bottom !== undefined && { bottom: menuPosition.bottom }),
            left: typeof window !== 'undefined' ? Math.max(8, Math.min(menuPosition.left, window.innerWidth - 264)) : menuPosition.left,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {confirmDelete ? (
            <div className="px-3 py-3 space-y-3">
              <p className="text-sm text-gray-900">Delete this order? Points will not be refunded.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading !== null}
                  className="px-3 py-1.5 text-sm font-medium bg-red-700 text-white rounded-md hover:bg-red-800 disabled:opacity-50"
                >
                  {loading === 'delete' ? 'Processing...' : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : confirmRefund ? (
            <div className="py-1">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Refund type</p>
              <button
                type="button"
                onClick={(e) => handleRefund(e, false)}
                disabled={loading !== null}
                className="w-full px-3 py-2.5 text-left text-sm font-medium text-gray-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 border-b border-gray-100"
              >
                <span className="block">Refund only</span>
                <span className="block text-xs font-normal text-gray-600 mt-0.5">Points back, no inventory change</span>
              </button>
              <button
                type="button"
                onClick={(e) => handleRefund(e, true)}
                disabled={loading !== null}
                className="w-full px-3 py-2.5 text-left text-sm font-medium text-gray-900 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 border-b border-gray-100"
              >
                <span className="block">Refund with return</span>
                <span className="block text-xs font-normal text-gray-600 mt-0.5">Points back + restore inventory</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmRefund(null);
                }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ← Back
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-red-800 hover:bg-red-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmRefund('refund');
                }}
                className="w-full px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                Refund
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
