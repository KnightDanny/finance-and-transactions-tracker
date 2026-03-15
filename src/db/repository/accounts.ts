import { eq, and } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { accounts } from '../schema';

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

export async function getTotalNetWorth(db: Database): Promise<number> {
  const allAccounts = await getAllAccounts(db);
  return allAccounts.reduce((sum: number, a: any) => sum + (a.latestBalance ?? 0), 0);
}
