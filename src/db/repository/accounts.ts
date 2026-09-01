import { eq, and } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { accounts, balanceSnapshots } from '../schema';
import { getRateMap } from './rates';

type Database = any; // Will be properly typed later

export async function getAllAccounts(db: Database) {
  return db.select().from(accounts);
}

export async function getAccountById(db: Database, id: string) {
  const results = await db.select().from(accounts).where(eq(accounts.id, id));
  return results[0] ?? null;
}

export async function getAccountByBankAndNumber(db: Database, bank: string, accountNumber: string) {
  const results = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.bank, bank), eq(accounts.accountNumber, accountNumber)));
  return results[0] ?? null;
}

export async function getAccountsByBank(db: Database, bank: string) {
  return db.select().from(accounts).where(eq(accounts.bank, bank));
}

export async function upsertAccount(
  db: Database,
  data: {
    bank: string;
    accountNumber: string;
    latestBalance?: number;
    latestBalanceAt?: string;
  }
) {
  const existing = await getAccountByBankAndNumber(db, data.bank, data.accountNumber);

  if (existing) {
    // Only update balance if the new one is more recent
    if (data.latestBalance !== undefined) {
      await db
        .update(accounts)
        .set({
          latestBalance: data.latestBalance,
          latestBalanceAt: data.latestBalanceAt,
        })
        .where(eq(accounts.id, existing.id));
    }
    return existing.id;
  }

  const id = uuid();
  await db.insert(accounts).values({
    id,
    bank: data.bank,
    accountNumber: data.accountNumber,
    latestBalance: data.latestBalance,
    latestBalanceAt: data.latestBalanceAt,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function updateAccountLabel(db: Database, id: string, label: string) {
  await db.update(accounts).set({ label }).where(eq(accounts.id, id));
}

/**
 * Create a user-maintained account (USD/USDT/USDC wallet, cash on hand, ...).
 * Balance changes are entered by hand — SMS sync never touches it.
 */
export async function createManualAccount(
  db: Database,
  data: {
    name: string;
    currency: string;
    balance: number;
    /** Backdate the balance anchor (e.g. epoch) so imported historical
     * transactions are allowed to roll the balance. Also skips the initial
     * snapshot — the imports write their own. */
    anchorAt?: string;
  }
): Promise<string> {
  const id = uuid();
  const now = new Date().toISOString();
  await db.insert(accounts).values({
    id,
    bank: 'MANUAL',
    accountNumber: data.name, // unique(bank, account_number) → one name per manual account
    label: data.name,
    currency: data.currency.toUpperCase(),
    isManual: true,
    latestBalance: data.balance,
    latestBalanceAt: data.anchorAt ?? now,
    createdAt: now,
  });
  if (!data.anchorAt) {
    await db.insert(balanceSnapshots).values({
      id: uuid(),
      accountId: id,
      balance: data.balance,
      recordedAt: now.split('T')[0],
      source: 'manual',
    });
  }
  return id;
}

/** Set a manual account's balance (in its own currency) and snapshot it. */
export async function updateManualBalance(db: Database, id: string, balance: number) {
  const now = new Date().toISOString();
  await db
    .update(accounts)
    .set({ latestBalance: balance, latestBalanceAt: now })
    .where(and(eq(accounts.id, id), eq(accounts.isManual, true)));
  await db.insert(balanceSnapshots).values({
    id: uuid(),
    accountId: id,
    balance,
    recordedAt: now.split('T')[0],
    source: 'manual',
  });
}

/** Delete a manual account and its snapshots. Refuses bank accounts. */
export async function deleteManualAccount(db: Database, id: string) {
  const account = await getAccountById(db, id);
  if (!account?.isManual) return;
  await db.delete(balanceSnapshots).where(eq(balanceSnapshots.accountId, id));
  await db.delete(accounts).where(eq(accounts.id, id));
}

/**
 * Total cash across accounts, converted to ETB via saved currency rates.
 * An account whose currency has no saved rate contributes nothing — the
 * Manage Accounts screen surfaces the missing rate.
 */
export async function getTotalNetWorth(db: Database): Promise<number> {
  const [allAccounts, rates] = await Promise.all([getAllAccounts(db), getRateMap(db)]);
  return allAccounts.reduce((sum: number, a: any) => {
    const rate = rates[a.currency ?? 'ETB'] ?? 0;
    return sum + (a.latestBalance ?? 0) * rate;
  }, 0);
}
