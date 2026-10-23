/**
 * Reads a bulk points file: email, points, reason (optional), point type (optional).
 *
 * Kept strict on purpose. The old reader read "1,000" as 1, 2.5 as 2 and 1e3 as 1, filed
 * any point type it did not know (including the bucket's own name) as universal, and took a
 * first data row as a header if any field mentioned "email". Every row now either parses
 * exactly or carries the reason it can't, and the admin sees all of it before anything is
 * applied.
 */

export type BulkBucket = 'universal' | 'restricted';

export interface BulkCsvRow {
  /** Line number in the file, header included, as a spreadsheet would show it */
  row: number;
  email: string;
  delta: number | null;
  bucket: BulkBucket | null;
  reason: string;
  error?: string;
}

const DEFAULT_REASON = 'Bulk points adjustment';
const MAX_POINTS = 2147483647; // the ledger column is a 32-bit integer

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/** A whole number, allowing thousands separators ("1,000", as spreadsheets write it). */
function parsePoints(raw: string): { value: number } | { error: string } {
  const text = raw.trim();
  if (/^[+-]?\d{1,3}(,\d{3})+$/.test(text) || /^[+-]?\d+$/.test(text)) {
    const value = parseInt(text.replace(/,/g, ''), 10);
    if (value === 0) return { error: "Points can't be zero" };
    if (Math.abs(value) > MAX_POINTS) return { error: 'Too many points for one row' };
    return { value };
  }
  if (/^[+-]?[\d,]*\.\d+$/.test(text)) return { error: 'Points must be a whole number' };
  return { error: text ? `"${text}" is not a number of points` : 'Points are missing' };
}

/**
 * @param restrictedNames lower-case names accepted for the restricted bucket, e.g.
 *   ['restricted', 'affinity']; "universal" is always accepted
 */
export function parseBulkPointsCsv(text: string, restrictedNames: string[]): BulkCsvRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const bucketOf = (value: string): BulkBucket | null =>
    value === 'universal' ? 'universal' : restrictedNames.includes(value) ? 'restricted' : null;
  const typeNames = ['universal', restrictedNames[restrictedNames.length - 1]].join(' or ');

  const rows: BulkCsvRow[] = [];
  let seenFirst = false;

  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const fields = parseCsvLine(line);

    // Every data row starts with an email address, so a first line that doesn't is a header
    if (!seenFirst) {
      seenFirst = true;
      if (!fields[0]?.includes('@')) return;
    }

    const row: BulkCsvRow = {
      row: index + 1,
      email: (fields[0] ?? '').trim().toLowerCase(),
      delta: null,
      bucket: null,
      reason: DEFAULT_REASON,
    };
    rows.push(row);

    if (!row.email.includes('@')) {
      row.error = 'Not an email address';
      return;
    }

    const points = parsePoints(fields[1] ?? '');
    if ('error' in points) {
      row.error = points.error;
      return;
    }
    row.delta = points.value;

    // Columns after the points: a reason, a point type, or both. A reason with commas in it
    // has to be quoted; unquoted, its pieces arrive as extra columns and are put back
    // together only when the last column is clearly a point type.
    const rest = fields.slice(2);
    const last = (rest[rest.length - 1] ?? '').toLowerCase();

    if (rest.length === 0) {
      row.bucket = 'universal';
    } else if (bucketOf(last)) {
      row.bucket = bucketOf(last);
      row.reason = rest.slice(0, -1).join(', ').trim() || DEFAULT_REASON;
    } else if (rest.length === 1) {
      row.bucket = 'universal';
      row.reason = rest[0] || DEFAULT_REASON;
    } else if (last === '') {
      row.bucket = 'universal';
      row.reason = rest.slice(0, -1).join(', ').trim() || DEFAULT_REASON;
    } else if (rest.length === 2) {
      row.error = `Unknown point type "${rest[1]}"; use ${typeNames}`;
    } else {
      row.error = 'Could not tell the reason from the point type; put a reason with commas in quotes';
    }
  });

  return rows;
}
