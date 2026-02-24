'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setProductActive, deleteProduct } from './actions';

interface ProductRowActionsProps {
  productId: string;
  productName: string;
  isActive: boolean;
  isDevMode: boolean;
}

export function ProductRowActions({ productId, productName, isActive, isDevMode }: ProductRowActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && triggerRef.current && typeof document !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 140;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight && rect.top > spaceBelow;
      setMenuPosition({
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top : undefined,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 160)),
      });
    } else {
      setMenuPosition(null);
    }
  }, [open]);

  const handleToggleActive = async () => {
    if (isDevMode) return;
    setLoading(true);
    const result = await setProductActive(productId, !isActive);
    setLoading(false);
    setOpen(false);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to update product status');
    }
  };

  const handleDelete = async () => {
    if (isDevMode) return;
    const confirmed = confirm(
      `Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone. The product and all its variants will be permanently deleted.`
    );
    if (!confirmed) return;
    setLoading(true);
    const result = await deleteProduct(productId);
    setLoading(false);
    setOpen(false);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete product');
    }
  };

  if (isDevMode) {
    return (
      <Link href={`/admin/products/${productId}/edit`} className="text-primary font-medium text-sm">
        Edit
      </Link>
    );
  }

  return (
    <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="p-1.5 rounded text-gray-600 disabled:opacity-50"
        aria-label="Product actions"
        disabled={loading}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>
      {open && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed py-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          style={{
            ...(menuPosition.top !== undefined && { top: menuPosition.top }),
            ...(menuPosition.bottom !== undefined && { bottom: menuPosition.bottom }),
            left: menuPosition.left,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={`/admin/products/${productId}/edit`}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-gray-900"
            onClick={() => setOpen(false)}
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={loading}
            className="w-full px-3 py-2 text-left text-sm font-medium text-gray-900 disabled:opacity-50"
          >
            {loading ? '...' : (isActive ? 'Deactivate' : 'Activate')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full px-3 py-2 text-left text-sm font-medium text-red-800 disabled:opacity-50"
          >
            Delete
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
