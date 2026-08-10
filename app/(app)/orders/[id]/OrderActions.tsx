'use client';

import { Button } from 'core/components/Button';
import { cbmBranding } from '@/branding';

export function PrintOrderButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Print Order
    </Button>
  );
}

export function EmailSupportButton({ orderNumber }: { orderNumber: string }) {
  const email = cbmBranding.support?.email;
  if (!email) return null;

  // Pre-fill the order number so the inbox knows which order it is about
  const href = `mailto:${email}?subject=${encodeURIComponent(`Order #${orderNumber}`)}`;

  return (
    <a href={href}>
      <Button variant="primary" size="lg">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Email Support
      </Button>
    </a>
  );
}

export function CallSupportButton() {
  const support = cbmBranding.support;
  if (!support?.phone) return null;

  return (
    <a href={`tel:${support.phoneDial ?? support.phone}`}>
      <Button variant="outline" size="lg">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        Call {support.phone}
      </Button>
    </a>
  );
}
