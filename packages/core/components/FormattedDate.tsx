'use client';

import { useEffect, useState } from 'react';

type DateFormat = 'date' | 'dateLong' | 'datetimeShort' | 'long';

interface FormattedDateProps {
  date: string | Date;
  format?: DateFormat;
  className?: string;
}

const FORMAT_OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  date: {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  },
  dateLong: {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  },
  datetimeShort: {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
  long: {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  },
};

/**
 * Renders a date in the viewer's own timezone and locale.
 *
 * A server-rendered page formats in the server's timezone (UTC on Vercel) and locale, and
 * with suppressHydrationWarning React kept that text rather than patching it, so a full
 * page load showed UTC (an 8pm order read as the next day) and only client-side navigation
 * showed local time. Now the first render, on the server and while hydrating alike, uses
 * UTC and en-US so the two agree, and once mounted it re-renders the viewer's way.
 *
 * A plain calendar date ("2026-10-23", from a date filter) is a day, not an instant, so it
 * is always shown as written rather than shifted into the day before west of UTC.
 */
export function FormattedDate({ date, format = 'date', className }: FormattedDateProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isCalendarDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return <span className={className}>—</span>;
  }

  const formatted =
    mounted && !isCalendarDate
      ? d.toLocaleDateString(undefined, FORMAT_OPTIONS[format])
      : d.toLocaleDateString('en-US', { ...FORMAT_OPTIONS[format], timeZone: 'UTC' });

  return (
    <time dateTime={d.toISOString()} className={className}>
      {formatted}
    </time>
  );
}
