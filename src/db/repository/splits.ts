import { eq, and, isNull } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { transactionSplits, categories, transactions } from '../schema';
import { createLoan, deleteLoan } from './loans';

type Database = any;

export interface SplitRow {
  id: string;
  transactionId: string;
  amount: number;
  categoryId: string | null;
  loanId: string | null;
  note: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
}

export async function getSplits(db: Database, transactionId: string): Promise<SplitRow[]> {
  return db
    .select({
      id: transactionSplits.id,
      transactionId: transactionSplits.transactionId,
      amount: transactionSplits.amount,
      categoryId: transactionSplits.categoryId,
      loanId: transactionSplits.loanId,
      note: transactionSplits.note,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactionSplits)
    .leftJoin(categories, eq(transactionSplits.categoryId, categories.id))
    .where(eq(transactionSplits.transactionId, transactionId));
}

/** Carve a category portion out of a transaction. */
export async function addCategorySplit(
  db: Database,
  transactionId: string,
  amount: number,
  categoryId: string
): Promise<string> {
  const id = uuid();
  await db.insert(transactionSplits).values({
    id,
    transactionId,
    amount,
    categoryId,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/**
 * Carve a loan portion out of a transaction: a debit's portion was lent, a
 * credit's borrowed. Creates the loan, links it to the split, and marks the
 * transaction itself as loan-linked (if it wasn't already) so it shows as a
 * loan everywhere the loan feature does. Returns the loan id.
 */
export async function addLoanSplit(
  db: Database,
  txn: { id: string; type: string; counterparty?: string | null; date: string; currency?: string | null },
  amount: number
): Promise<string> {
  const loanId = await createLoan(db, {
    person: txn.counterparty?.trim() || 'Unknown',
    direction: txn.type === 'credit' ? 'borrowed' : 'lent',
    principal: amount,
    currency: txn.currency ?? 'ETB',
    startDate: txn.date,
    note: 'Split from transaction',
  });
  await db.insert(transactionSplits).values({
    id: uuid(),
    transactionId: txn.id,
    amount,
    loanId,
    createdAt: new Date().toISOString(),
  });
  await db
    .update(transactions)
    .set({ loanId })
    .where(and(eq(transactions.id, txn.id), isNull(transactions.loanId)));
  return loanId;
}

/** Remove a split; a loan split takes its loan (and its payments) with it. */
export async function deleteSplit(db: Database, split: { id: string; loanId?: string | null }) {
  await db.delete(transactionSplits).where(eq(transactionSplits.id, split.id));
  if (split.loanId) await deleteLoan(db, split.loanId);
}
