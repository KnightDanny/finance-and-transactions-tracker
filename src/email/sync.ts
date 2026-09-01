import { Storage } from 'expo-sqlite/kv-store';
import { eq } from 'drizzle-orm';
import { parseEmail, allSenders } from './dispatcher';
import { fetchEmails, getConnectedEmail } from './gmail';
import { ParsedEmailTransaction } from './types';
import { accounts, balanceSnapshots } from '@/src/db/schema';
import { getAllAccounts, createManualAccount } from '@/src/db/repository/accounts';
import { insertTransaction } from '@/src/db/repository/transactions';
import { getRateMap, setRate, fetchRatesToEtb } from '@/src/db/repository/rates';
import { generateId as uuid } from '@/src/utils/id';

const WATERMARK_KEY = 'email_last_synced_at';
const EPOCH = '1970-01-01T00:00:00.000Z';

/** USDC is held 1:1 with USDT — one stablecoin account per provider. */
function accountCurrency(c: string): string {
  return c === 'USDC' ? 'USDT' : c;
}

export interface EmailSyncResult {
  connected: boolean;
  /** False while no provider parsers are registered yet. */
  configured: boolean;
  newTransactions: number;
  skippedDuplicates: number;
  parseErrors: number;
}

/** The manual account a parsed email belongs to: the manual account in the
 * right currency whose name mentions the provider, else a fresh one named
 * after the provider. Never falls back to an unrelated same-currency account —
 * that would merge Binance USDT and Bybit USDT into one balance. */
async function resolveAccount(db: any, parsed: ParsedEmailTransaction): Promise<string> {
  const currency = accountCurrency(parsed.currency);
  const all = await getAllAccounts(db);
  const bySource = all.find(
    (a: any) =>
      a.isManual &&
      a.currency === currency &&
      (a.label ?? a.accountNumber ?? '').toUpperCase().includes(parsed.source)
  );
  if (bySource) return bySource.id;
  return createManualAccount(db, {
    name: `${parsed.source} ${currency}`,
    currency,
    balance: 0,
    // Epoch anchor: this account exists only to receive imported history, so
    // every imported transaction may roll its balance from 0.
    anchorAt: EPOCH,
  });
}

/**
 * Fill in ETB rates for currencies in use that have none saved yet — net worth
 * and loan conversion count a rateless currency as 0. Existing rates
 * (especially manually set parallel rates) are never overwritten; network
 * failure is non-fatal.
 */
async function fillMissingRates(db: any) {
  try {
    const [all, rateMap] = await Promise.all([getAllAccounts(db), getRateMap(db)]);
    const used = new Set<string>(all.map((a: any) => a.currency ?? 'ETB'));
    used.add('USDT'); // loans can be USDT-denominated
    const missing = [...used].filter((c) => rateMap[c] == null);
    if (missing.length === 0) return;
    const fetched = await fetchRatesToEtb(missing);
    for (const [c, r] of Object.entries(fetched)) await setRate(db, c, r, 'auto');
  } catch {
    // offline — the Accounts & Currencies screen still surfaces missing rates
  }
}

/**
 * Email counterpart of syncSms: fetch provider emails since the watermark,
 * parse, dedupe on (reference_no, account_id), insert, and roll the account
 * balance forward (emails rarely state a running balance the way bank SMS do).
 */
export async function syncEmails(db: any): Promise<EmailSyncResult> {
  const result: EmailSyncResult = {
    connected: false,
    configured: allSenders().length > 0,
    newTransactions: 0,
    skippedDuplicates: 0,
    parseErrors: 0,
  };
  if (!result.configured) return result;

  const email = await getConnectedEmail();
  if (!email) return result;
  result.connected = true;

  const watermark = parseInt(Storage.getItemSync(WATERMARK_KEY) ?? '0', 10);
  const afterSeconds = Math.max(0, Math.floor(watermark / 1000));
  const query = `from:(${allSenders().join(' OR ')})${afterSeconds > 0 ? ` after:${afterSeconds}` : ''}`;

  const emails = await fetchEmails(query);
  emails.sort((a, b) => a.internalDate - b.internalDate);

  let newest = watermark;
  for (const raw of emails) {
    if (raw.internalDate <= watermark) continue;
    if (raw.internalDate > newest) newest = raw.internalDate;

    const parsed = parseEmail(raw);
    if (!parsed) {
      result.parseErrors++;
      continue;
    }

    const accountId = await resolveAccount(db, parsed);
    const txnId = await insertTransaction(db, {
      accountId,
      type: parsed.type,
      amount: parsed.amount,
      balanceAfter: parsed.balanceAfter,
      counterparty: parsed.counterparty,
      referenceNo: parsed.referenceNo,
      date: parsed.date,
      rawSms: parsed.rawEmail,
      smsTimestamp: parsed.emailTimestamp,
      source: 'email',
    });
    if (!txnId) {
      result.skippedDuplicates++;
      continue;
    }
    result.newTransactions++;

    // Roll the manual account's balance — but the user-set balance is
    // authoritative for everything up to when it was set. Only transactions
    // dated on/after that anchor adjust it; older imports are history only.
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    const anchor = (account?.latestBalanceAt ?? '').split('T')[0];
    if (parsed.date >= anchor) {
      const newBalance =
        parsed.balanceAfter ??
        (account?.latestBalance ?? 0) + (parsed.type === 'credit' ? parsed.amount : -parsed.amount);
      await db
        .update(accounts)
        .set({ latestBalance: newBalance, latestBalanceAt: parsed.date })
        .where(eq(accounts.id, accountId));
      await db.insert(balanceSnapshots).values({
        id: uuid(),
        accountId,
        balance: newBalance,
        recordedAt: parsed.date,
        source: 'email',
      });
    }
  }

  if (newest > watermark) Storage.setItemSync(WATERMARK_KEY, String(newest));
  await fillMissingRates(db);
  return result;
}
