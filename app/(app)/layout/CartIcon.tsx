'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCartItemCount } from '@/lib/cart/storage';

export default function CartIcon() {
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    // Initial load
    updateCount();

    // Listen for storage events (from other tabs/windows)
    const handleStorageChange = () => {
      updateCount();
    };

    window.addEventListener('storage', handleStorageChange);

    // Custom event for same-tab updates
    const handleCartUpdate = () => {
      updateCount();
    };
    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, []);

  const updateCount = () => {
    setItemCount(getCartItemCount());
  };

  return (
    <Link 
      href="/cart" 
      className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <span className="sr-only">Cart</span>
      <svg 
        className="w-6 h-6" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
        />
      </svg>
      {itemCount > 0 && (
        <span className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-sm">
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      )}
    </Link>
  );
}
