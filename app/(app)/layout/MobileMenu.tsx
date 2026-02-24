'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileMenuProps {
  userEmail: string;
  isAdmin?: boolean;
  isDevMode: boolean;
}

export default function MobileMenu({ userEmail, isAdmin, isDevMode }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Shop' },
    { href: '/orders', label: 'Orders' },
    { href: '/points-history', label: 'Points' },
    { href: '/profile', label: 'Profile' },
  ];

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-gray-700 hover:bg-gray-100"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 animate-in slide-in-from-top">
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive
                        ? 'bg-gray-200 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t pt-3 mt-3">
                <div className="px-3 py-2 text-sm text-gray-600">{userEmail}</div>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-primary hover:bg-gray-50"
                  >
                    Admin
                  </Link>
                )}
                {isDevMode ? (
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Login
                  </Link>
                ) : (
                  <form action="/logout" method="POST">
                    <button
                      type="submit"
                      className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
