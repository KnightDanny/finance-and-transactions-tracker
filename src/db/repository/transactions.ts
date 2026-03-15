import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { transactions, accounts, categories } from '../schema';

type Database = any;

export interface InsertTransaction {
  accountId: string;
  type: 'credit' | 'debit';
  amount: number;
  totalAmount?: number;
  serviceCharge?: number;
  vat?: number;
  disasterFund?: number;
  balanceAfter?: number;
  counterparty?: string;
  referenceNo?: string;
  categoryId?: string;
  date: string;
  rawSms?: string;
  smsTimestamp?: number;
  source?: 'sms' | 'manual' | 'reconciliation';
  isReconciled?: boolean;
  note?: string;
}

export async function insertTransaction(db: Database, data: InsertTransaction): Promise<string | null> {
  const id = uuid();
  try {
    await db.insert(transactions).values({
      id,
      accountId: data.accountId,
      type: data.type,
      amount: data.amount,
      totalAmount: data.totalAmount,
      serviceCharge: data.serviceCharge ?? 0,
      vat: data.vat ?? 0,
      disasterFund: data.disasterFund ?? 0,
      balanceAfter: data.balanceAfter,
      counterparty: data.counterparty,
      referenceNo: data.referenceNo,
      categoryId: data.categoryId,
      date: data.date,
      rawSms: data.rawSms,
      smsTimestamp: data.smsTimestamp,
      source: data.source ?? 'sms',
      isReconciled: data.isReconciled ?? true,
      note: data.note,
      createdAt: new Date().toISOString(),
    });
    return id;
  } catch (e: any) {
    // Duplicate reference_no + account_id — skip
    if (e.message?.includes('UNIQUE constraint')) {
      return null;
    }
    throw e;
  }
}

export async function getTransactionById(db: Database, id: string) {
  const results = await db.select().from(transactions).where(eq(transactions.id, id));
  return results[0] ?? null;
}

export async function getRecentTransactions(db: Database, limit = 10) {
  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      amount: transactions.amount,
      totalAmount: transactions.totalAmount,
      balanceAfter: transactions.balanceAfter,
      counterparty: transactions.counterparty,
      referenceNo: transactions.referenceNo,
      date: transactions.date,
      source: transactions.source,
      smsTimestamp: transactions.smsTimestamp,
      bank: accounts.bank,
      accountNumber: accounts.accountNumber,
      accountLabel: accounts.label,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .orderBy(desc(transactions.date), desc(transactions.smsTimestamp))
    .limit(limit);
  return rows;
}

export async function getTransactionsByAccount(db: Database, accountId: string, limit = 50) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .orderBy(desc(transactions.date), desc(transactions.smsTimestamp))
    .limit(limit);
}

export async function getTransactionsFiltered(
  db: Database,
  filters: {
    accountId?: string;
    type?: 'credit' | 'debit';
    categoryId?: string;
    categoryIds?: string[];
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
) {
  const conditions = [];

  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(transactions.categoryId, filters.categoryIds));
  } else if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(transactions.date, filters.endDate));

  let query = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      amount: transactions.amount,
      totalAmount: transactions.totalAmount,
      balanceAfter: transactions.balanceAfter,
      counterparty: transactions.counterparty,
      referenceNo: transactions.referenceNo,
      categoryId: transactions.categoryId,
      date: transactions.date,
      source: transactions.source,
      smsTimestamp: transactions.smsTimestamp,
      note: transactions.note,
      bank: accounts.bank,
      accountNumber: accounts.accountNumber,
      accountLabel: accounts.label,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query
    .orderBy(desc(transactions.date), desc(transactions.smsTimestamp))
    .limit(filters.limit ?? 50);
}

export async function getPreviousTransaction(db: Database, accountId: string, beforeDate: string, excludeId: string) {
  const results = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        lte(transactions.date, beforeDate)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.smsTimestamp))
    .limit(2);

  // Return the most recent transaction that isn't the current one
  return results.find((t: any) => t.id !== excludeId) ?? null;
}

export async function updateTransactionCategory(db: Database, id: string, categoryId: string) {
  await db.update(transactions).set({ categoryId }).where(eq(transactions.id, id));
}

export async function updateTransactionNote(db: Database, id: string, note: string) {
  await db.update(transactions).set({ note }).where(eq(transactions.id, id));
}

export async function updateTransactionCounterparty(db: Database, id: string, counterparty: string) {
  await db.update(transactions).set({ counterparty }).where(eq(transactions.id, id));
}

export async function getMonthlySpendingByCategory(db: Database, month: string) {
  // month format: 'YYYY-MM'
  const startDate = `${month}-01`;
  const endDate = `${month}-31`; // Safe upper bound

  return db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'debit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(transactions.categoryId);
}
