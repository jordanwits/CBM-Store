'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { BrandMark } from 'core/components/BrandMark';
import { createClient } from '@/lib/supabase/client';

interface AdminLayoutClientProps {
  children: React.ReactNode;
  isDevMode: boolean;
}

export function AdminLayoutClient({ children, isDevMode }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isDevMode) {
        if (cancelled) return;
        setEmail('demo@cbmplastics.com');
        setLoaded(true);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;
      setEmail(user?.email || '');
      setLoaded(true);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase, isDevMode]);

  const userEmail = isDevMode ? 'demo@cbmplastics.com' : email;

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/admin', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      name: 'Products', 
      href: '/admin/products',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    { 
      name: 'Orders', 
      href: '/admin/orders',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    { 
      name: 'Users', 
      href: '/admin/users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    { 
      name: 'Points', 
      href: '/admin/points',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      name: 'Reports', 
      href: '/admin/reports',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      name: 'Exports', 
      href: '/admin/exports',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar - Matches Store Design */}
      <nav className="bg-white border-b border-gray-300 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-3 lg:px-4">
          <div className="flex justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-8">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/admin" className="hover:opacity-80 transition-opacity">
                <BrandMark showText={false} imageClassName="h-14 w-auto" />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {!loaded ? (
                <span className="text-sm text-gray-500 px-3 py-1.5">Loading…</span>
              ) : (
                <>
                  <span className="text-sm text-gray-600 truncate max-w-[150px] hidden sm:inline">{userEmail}</span>
                  <form action="/logout" method="POST">
                    <button
                      type="submit"
                      className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Logout
                    </button>
                  </form>
                </>
              )}
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 p-2 sm:px-3 sm:py-1.5 rounded-md hover:bg-gray-100 transition-colors inline-flex items-center gap-1 border-l pl-3 ml-3 shrink-0"
                aria-label="Back to Store"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">Back to Store</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-3 lg:px-4 py-8 flex gap-8">
        {/* Sidebar Navigation */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 
          transform transition-transform duration-300 ease-in-out lg:transform-none
          ${isSidebarOpen ? 'translate-x-0 bg-white border-r border-gray-200' : '-translate-x-full lg:translate-x-0'}
          lg:w-56 flex-shrink-0
        `}>
          <div className="lg:sticky lg:top-20 p-4 space-y-1">
            {/* Mobile close button */}
            <div className="lg:hidden flex justify-between items-center mb-4 pb-4 border-b">
              <span className="font-semibold text-gray-900">Navigation</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
          </div>
        </aside>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
