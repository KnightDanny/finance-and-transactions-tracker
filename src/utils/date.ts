import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/**
 * Parse a date string that could be DD/MM/YYYY or YYYY-MM-DD format.
 * Returns an ISO date string (YYYY-MM-DD) or null.
 */
export function parseDate(text: string): string | null {
  // Try DD/MM/YYYY (CBE format)
  let d = dayjs(text.trim(), 'DD/MM/YYYY', true);
  if (d.isValid()) return d.format('YYYY-MM-DD');

  // Try YYYY-MM-DD (TeleBirr sometimes)
  d = dayjs(text.trim(), 'YYYY-MM-DD', true);
  if (d.isValid()) return d.format('YYYY-MM-DD');

  // Try with time included
  d = dayjs(text.trim(), 'DD/MM/YYYY HH:mm:ss', true);
  if (d.isValid()) return d.format('YYYY-MM-DD');

  d = dayjs(text.trim(), 'YYYY-MM-DD HH:mm:ss', true);
  if (d.isValid()) return d.format('YYYY-MM-DD');

  return null;
}

/**
 * Extract a date from an SMS body text.
 * Looks for DD/MM/YYYY or YYYY-MM-DD patterns.
 */
export function extractDateFromText(text: string): string | null {
  // Try DD/MM/YYYY pattern
  const ddmmyyyy = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (ddmmyyyy) {
    const parsed = parseDate(ddmmyyyy[1]);
    if (parsed) return parsed;
  }

  // Try YYYY-MM-DD pattern
  const yyyymmdd = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (yyyymmdd) {
    const parsed = parseDate(yyyymmdd[1]);
    if (parsed) return parsed;
  }

  return null;
}
