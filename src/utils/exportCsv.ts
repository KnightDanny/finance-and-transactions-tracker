import { StorageAccessFramework } from 'expo-file-system/legacy';
import { sql } from 'drizzle-orm';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Long digit runs (telebirr accounts like 251933563343) get mangled into
 * scientific notation by Excel/Sheets — the ="..." form keeps them as text. */
function csvText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/^\d{7,}$/.test(s)) return `="${s}"`;
  return csvEscape(s);
}

const HEADERS = [
  'Date', 'Bank', 'Account', 'Type', 'Amount', 'Total Amount', 'Service Charge',
  'VAT', 'Disaster Fund', 'Balance After', 'Counterparty', 'Category',
  'Reference No', 'Source', 'Note',
];

/**
 * Export every transaction (oldest first) as CSV via the system folder picker.
 * Returns the number of rows written, or null if the user cancelled the picker.
 */
export async function exportTransactionsCsv(db: any): Promise<number | null> {
  const rows = await db.all(sql`
    SELECT t.date, a.bank, COALESCE(a.label, a.account_number) AS account,
           t.type, t.amount, t.total_amount, t.service_charge, t.vat,
           t.disaster_fund, t.balance_after, t.counterparty, c.name AS category,
           t.reference_no, t.source, t.note
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    ORDER BY t.date ASC, t.sms_timestamp ASC
  `);

  const lines = [HEADERS.join(',')];
  for (const r of rows as any[]) {
    lines.push([
      csvEscape(r.date), csvEscape(r.bank), csvText(r.account), csvEscape(r.type),
      csvEscape(r.amount), csvEscape(r.total_amount), csvEscape(r.service_charge),
      csvEscape(r.vat), csvEscape(r.disaster_fund), csvEscape(r.balance_after),
      csvEscape(r.counterparty), csvEscape(r.category), csvText(r.reference_no),
      csvEscape(r.source), csvEscape(r.note),
    ].join(','));
  }
  const csv = lines.join('\n');

  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;

  const today = new Date().toISOString().split('T')[0];
  const fileUri = await StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    `budget-tracker-transactions-${today}`,
    'text/csv'
  );
  await StorageAccessFramework.writeAsStringAsync(fileUri, csv);
  return rows.length;
}
