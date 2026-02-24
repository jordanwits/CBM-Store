'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface ClickableTableRowProps {
  href: string;
  children: ReactNode;
}

export function ClickableTableRow({ href, children }: ClickableTableRowProps) {
  const router = useRouter();

  return (
    <tr 
      onClick={() => router.push(href)}
      className="hover:!bg-gray-50 !cursor-pointer transition-colors active:!bg-gray-100"
      tabIndex={0}
      role="button"
      aria-label="Click to view order details"
    >
      {children}
    </tr>
  );
}
