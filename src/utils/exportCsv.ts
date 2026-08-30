import { StorageAccessFramework } from 'expo-file-system/legacy';
import { sql } from 'drizzle-orm';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
      r.date, r.bank, r.account, r.type, r.amount, r.total_amount,
      r.service_charge, r.vat, r.disaster_fund, r.balance_after,
      r.counterparty, r.category, r.reference_no, r.source, r.note,
    ].map(csvEscape).join(','));
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
