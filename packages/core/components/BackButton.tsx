import React from 'react';
import Link from 'next/link';

interface BackButtonProps {
  href: string;
  label?: string;
  className?: string;
}

export function BackButton({ href, label = 'Back', className = '' }: BackButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors group ${className}`}
    >
      <svg 
        className="w-5 h-5 transition-transform group-hover:-translate-x-1" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M10 19l-7-7m0 0l7-7m-7 7h18" 
        />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
