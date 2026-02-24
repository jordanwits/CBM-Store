'use client';

import { ReactNode } from 'react';

export function OrderActionsCell({ children }: { children: ReactNode }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block shrink-0">
      {children}
    </div>
  );
}
