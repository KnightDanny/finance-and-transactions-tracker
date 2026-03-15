import { eq, and, desc, inArray } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { reconciliationGaps, accounts, transactions } from '@/src/db/schema';
import { getPreviousTransaction } from '@/src/db/repository/transactions';

// Minimal tolerance for floating-point rounding only
const TOLERANCE = 0.01;

interface TransactionInfo {
  id: string;
  accountId: string;
  type: 'credit' | 'debit';
  amount: number;
  totalAmount?: number;
  balanceAfter?: number;
  date: string;
  smsTimestamp?: number;
}

/**
 * Check if a newly inserted transaction creates a balance gap
 * compared to the previous transaction for the same account.
 *
 * Logic: previous_balance ± transaction_total should equal current_balance.
 * If not, there's a missing transaction between the two.
 */
export async function checkReconciliation(
  db: any,
  newTx: TransactionInfo
): Promise<any | null> {
  if (newTx.balanceAfter == null) return null;

  // Find the previous transaction for this specific account
  const prevTx = await getPreviousTransaction(
    db,
    newTx.accountId,
    newTx.date,
    newTx.id
  );

  if (!prevTx || prevTx.balanceAfter == null) {
    // First transaction for this account — no gap check possible
    return null;
  }

  const previousBalance = prevTx.balanceAfter;
  let expectedBalance: number;

  if (newTx.type === 'debit') {
    const deducted = newTx.totalAmount ?? newTx.amount;
    expectedBalance = previousBalance - deducted;
  } else {
    expectedBalance = previousBalance + newTx.amount;
  }

  const actualBalance = newTx.balanceAfter;
  const gap = actualBalance - expectedBalance;

  if (Math.abs(gap) > TOLERANCE) {
    // Gap detected — insert record with the transaction date (not today)
    const gapId = uuid();
    await db.insert(reconciliationGaps).values({
      id: gapId,
      accountId: newTx.accountId,
      expectedBalance,
      actualBalance,
      gapAmount: gap,
      detectedAt: newTx.smsTimestamp
        ? new Date(newTx.smsTimestamp).toISOString()
        : newTx.date,
      resolved: false,
      transactionBeforeId: prevTx.id,
      transactionAfterId: newTx.id,
    });

    return {
      id: gapId,
      expectedBalance,
      actualBalance,
      gapAmount: gap,
    };
  }

  return null;
}

/**
 * Get all unresolved reconciliation gaps with account info.
 */
export async function getUnresolvedGaps(db: any) {
  const gaps = await db
    .select({
      id: reconciliationGaps.id,
      accountId: reconciliationGaps.accountId,
      expectedBalance: reconciliationGaps.expectedBalance,
      actualBalance: reconciliationGaps.actualBalance,
      gapAmount: reconciliationGaps.gapAmount,
      detectedAt: reconciliationGaps.detectedAt,
      resolved: reconciliationGaps.resolved,
      transactionBeforeId: reconciliationGaps.transactionBeforeId,
      transactionAfterId: reconciliationGaps.transactionAfterId,
      bank: accounts.bank,
      accountNumber: accounts.accountNumber,
    })
    .from(reconciliationGaps)
    .leftJoin(accounts, eq(reconciliationGaps.accountId, accounts.id))
    .where(eq(reconciliationGaps.resolved, false))
    .orderBy(desc(reconciliationGaps.detectedAt));

  // Fetch before/after transaction timestamps for each gap
  const txIds = gaps.flatMap((g: any) => [g.transactionBeforeId, g.transactionAfterId].filter(Boolean));
  if (txIds.length === 0) return gaps;

  const txRows = await db
    .select({ id: transactions.id, smsTimestamp: transactions.smsTimestamp, date: transactions.date })
    .from(transactions)
    .where(inArray(transactions.id, txIds));

  const txMap = new Map(txRows.map((t: any) => [t.id, t]));

  return gaps.map((g: any) => ({
    ...g,
    beforeTx: txMap.get(g.transactionBeforeId) ?? null,
    afterTx: txMap.get(g.transactionAfterId) ?? null,
  }));
}

/**
 * Mark a gap as resolved, linking it to the manual transaction that fills it.
 */
export async function resolveGap(db: any, gapId: string, resolvedTransactionId: string) {
  await db
    .update(reconciliationGaps)
    .set({
      resolved: true,
      resolvedTransactionId: resolvedTransactionId,
    })
    .where(eq(reconciliationGaps.id, gapId));
}

/**
 * Skip a single gap — mark as resolved without a filling transaction (unaccounted).
 */
export async function skipGap(db: any, gapId: string) {
  await db
    .update(reconciliationGaps)
    .set({ resolved: true })
    .where(eq(reconciliationGaps.id, gapId));
}

/**
 * Skip all unresolved gaps at once.
 */
export async function skipAllGaps(db: any) {
  await db
    .update(reconciliationGaps)
    .set({ resolved: true })
    .where(eq(reconciliationGaps.resolved, false));
}
