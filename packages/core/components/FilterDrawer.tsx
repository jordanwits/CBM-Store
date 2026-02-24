'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface FilterDrawerProps {
  children: React.ReactNode;
  triggerLabel?: string;
  hasActiveFilters?: boolean;
  /** Optional: wrapper for desktop. Default renders in a div. Use "lg:w-52 flex-shrink-0" for sidebar layout. */
  wrapperClassName?: string;
  /** When true, used for inline filters (e.g. in headers). Renders children directly without aside wrapper. */
  inline?: boolean;
}

/**
 * On mobile: shows a button that opens a slide-in drawer with filter content.
 * On lg and up: renders children inline (sidebar or inline based on props).
 */
export function FilterDrawer({
  children,
  triggerLabel = 'Filters',
  hasActiveFilters = false,
  wrapperClassName = '',
  inline = false,
}: FilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trigger slide-in animation when drawer opens
  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => setIsEntering(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setIsEntering(false);
    }
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const drawerContent = mounted && isOpen ? (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={triggerLabel}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={handleBackdropClick}
      />
      {/* Slide-in panel */}
      <div
        className={`absolute inset-y-0 left-0 w-full max-w-sm bg-white shadow-xl overflow-y-auto transition-transform duration-300 ease-out ${
          isEntering ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">{triggerLabel}</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 -m-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 pb-8">{children}</div>
      </div>
    </div>
  ) : null;

  const desktopContent = inline ? (
    <div className="hidden lg:block">{children}</div>
  ) : (
    <aside className={`hidden lg:block flex-shrink-0 ${wrapperClassName}`}>
      {children}
    </aside>
  );

  return (
    <>
      {/* Desktop: inline or sidebar content */}
      {desktopContent}
      {/* Mobile: trigger button */}
      <div className={`lg:hidden ${inline ? '' : 'flex-shrink-0'}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {triggerLabel}
          {hasActiveFilters && (
            <span className="ml-1 w-2 h-2 rounded-full bg-primary" aria-hidden />
          )}
        </Button>
      </div>
      {/* Mobile: drawer (portal) */}
      {mounted && createPortal(drawerContent, document.body)}
    </>
  );
}
