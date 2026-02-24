'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from 'core/components/Button';
import { createClient } from '@/lib/supabase/client';

const MENU_ANIMATION_MS = 200;

export default function MarketingHeaderActions() {
  const supabase = useMemo(() => createClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenu = () => {
    if (exitTimeoutRef.current) return;
    setIsExiting(true);
    exitTimeoutRef.current = setTimeout(() => {
      setMenuOpen(false);
      setIsExiting(false);
      exitTimeoutRef.current = null;
    }, MENU_ANIMATION_MS);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;
      setHasUser(Boolean(user));
      setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (menuOpen) {
      const frame = requestAnimationFrame(() => setIsEntering(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setIsEntering(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (menuOpen || isExiting) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen, isExiting]);

  if (!loaded) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Loading…</span>
      </div>
    );
  }

  const desktopButtons = (
    <div className="hidden md:flex flex-wrap justify-end gap-2 sm:gap-3 min-w-0">
      {hasUser ? (
        <Link href="/dashboard" className="shrink-0">
          <Button variant="primary">Go to Dashboard</Button>
        </Link>
      ) : (
        <>
          <Link href="/login" className="shrink-0">
            <Button variant="outline">Login</Button>
          </Link>
          <Link href="/request-access" className="shrink-0">
            <Button variant="primary">Request Access</Button>
          </Link>
        </>
      )}
    </div>
  );

  const mobileMenu = (
    <div className="md:hidden">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {menuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {(menuOpen || isExiting) && (
        <>
          <div
            className={`fixed top-16 sm:top-20 left-0 right-0 bottom-0 bg-black/25 z-40 transition-opacity duration-200 ${
              isEntering && !isExiting ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeMenu}
            aria-hidden="true"
          />
          <div
            className={`fixed top-16 sm:top-20 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 transition-transform duration-200 ease-out ${
              isEntering && !isExiting ? 'translate-y-0' : '-translate-y-full'
            }`}
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              {hasUser ? (
                <Link href="/dashboard" onClick={closeMenu} className="block">
                  <Button variant="primary" className="w-full">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/request-access" onClick={closeMenu} className="block">
                    <Button variant="primary" className="w-full">Request Access</Button>
                  </Link>
                  <Link href="/login" onClick={closeMenu} className="block">
                    <Button variant="outline" className="w-full">Login</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {desktopButtons}
      {mobileMenu}
    </>
  );
}
