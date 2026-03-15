import { eq, and } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { reconciliationGaps } from '@/src/db/schema';
import { getPreviousTransaction } from '@/src/db/repository/transactions';

const TOLERANCE = 0.05; // ETB tolerance for floating-point comparison

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
 * Returns the gap record if one is detected, null otherwise.
 */
export async function checkReconciliation(
  db: any,
  newTx: TransactionInfo
): Promise<any | null> {
  if (newTx.balanceAfter == null) return null;

  // Find the previous transaction for this account
  const prevTx = await getPreviousTransaction(
    db,
    newTx.accountId,
    newTx.date,
    newTx.smsTimestamp
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
    // Gap detected — insert record
    const gapId = uuid();
    await db.insert(reconciliationGaps).values({
      id: gapId,
      accountId: newTx.accountId,
      expectedBalance,
      actualBalance,
      gapAmount: gap,
      detectedAt: new Date().toISOString(),
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
 * Get all unresolved reconciliation gaps.
 */
export async function getUnresolvedGaps(db: any) {
  return db
    .select()
    .from(reconciliationGaps)
    .where(eq(reconciliationGaps.resolved, false));
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
