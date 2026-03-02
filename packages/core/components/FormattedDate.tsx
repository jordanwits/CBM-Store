'use client';

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

export function FormattedDate({ date, format = 'date', className }: FormattedDateProps) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const isoString = d.toISOString();
  const formatted = d.toLocaleDateString(undefined, FORMAT_OPTIONS[format]);

  return (
    <time dateTime={isoString} className={className} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
