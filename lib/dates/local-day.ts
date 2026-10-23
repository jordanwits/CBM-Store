/**
 * Calendar days in the viewer's own timezone, for the history date filters.
 *
 * The filters used to build their dates with toISOString(), which is UTC, and the pages
 * read "2026-10-23" as UTC midnight (and an end date's 23:59 in the server's zone, also
 * UTC), so someone in Pacific time filtering one day got the evening before it and lost
 * that day's own evening. The browser now writes its own local day and sends its UTC offset
 * with it (`tz`, in minutes, as Date.getTimezoneOffset() gives it), and the page turns a day
 * into that viewer's midnight-to-midnight.
 */

/** A moment (now by default) as YYYY-MM-DD in the browser's own timezone. */
export function localDayString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The browser's offset as the filters send it: minutes behind UTC, 420 in Pacific summer time. */
export function localOffsetParam(): string {
  return String(new Date().getTimezoneOffset());
}

/**
 * When a YYYY-MM-DD day starts for a viewer at `tzOffset`, or null for something that isn't
 * a date (a hand-edited URL), so the filter is skipped rather than the page failing. A
 * missing or unreadable offset counts as UTC.
 */
export function startOfLocalDay(day: string, tzOffset: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const offset = Number(tzOffset);
  const minutes = tzOffset != null && Number.isFinite(offset) && Math.abs(offset) <= 14 * 60 ? offset : 0;
  const start = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]) + minutes * 60_000);
  return isNaN(start.getTime()) ? null : start;
}

/** When the following day starts, so an end date takes in the whole of its own day. */
export function startOfNextLocalDay(day: string, tzOffset: string | null | undefined): Date | null {
  const start = startOfLocalDay(day, tzOffset);
  return start ? new Date(start.getTime() + 86_400_000) : null;
}
