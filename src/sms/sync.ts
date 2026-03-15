import { eq } from 'drizzle-orm';
import { parseSms, isFromKnownBank } from './dispatcher';
import { readSmsInbox, getMockSmsData } from './reader';
import { RawSms } from './types';
import { upsertAccount } from '@/src/db/repository/accounts';
import { insertTransaction } from '@/src/db/repository/transactions';
import { insertBalanceSnapshot } from '@/src/db/repository/balanceSnapshots';
import { checkReconciliation } from '@/src/reconciliation/engine';
import { autoCategorize } from '@/src/budget/categories';
import { updateTransactionCategory } from '@/src/db/repository/transactions';
import { smsSyncState } from '@/src/db/schema';

interface SyncResult {
  newTransactions: number;
  skippedDuplicates: number;
  parseErrors: number;
  gaps: number;
}

/**
 * Main sync orchestrator: reads SMS, parses, deduplicates, and inserts transactions.
 */
export async function syncSms(db: any, useMockData: boolean = false): Promise<SyncResult> {
  const result: SyncResult = {
    newTransactions: 0,
    skippedDuplicates: 0,
    parseErrors: 0,
    gaps: 0,
  };

  // Get last sync timestamp
  const syncState = await db.select().from(smsSyncState);
  let lastSyncedAt = 0;
  if (syncState.length > 0) {
    lastSyncedAt = syncState[0].lastSyncedAt;
  }

  // Read SMS messages
  let messages: RawSms[];
  if (useMockData) {
    messages = getMockSmsData();
  } else {
    messages = await readSmsInbox(lastSyncedAt);
  }

  if (messages.length === 0) return result;

  // Sort by timestamp ascending (oldest first)
  messages.sort((a, b) => a.date - b.date);

  let newestTimestamp = lastSyncedAt;

  for (const sms of messages) {
    // Skip if older than last sync
    if (sms.date <= lastSyncedAt && !useMockData) continue;

    // Try to parse
    const parsed = parseSms(sms);

    if (!parsed) {
      if (isFromKnownBank(sms)) {
        result.parseErrors++;
        console.warn('Failed to parse bank SMS:', sms.body.substring(0, 100));
      }
      continue;
    }

    // Upsert account
    const accountId = await upsertAccount(db, {
      bank: parsed.bank,
      accountNumber: parsed.accountNumber,
      latestBalance: parsed.balanceAfter,
      latestBalanceAt: parsed.date,
    });

    // Insert transaction (returns null if duplicate)
    const txnId = await insertTransaction(db, {
      accountId,
      type: parsed.type,
      amount: parsed.amount,
      totalAmount: parsed.totalAmount,
      serviceCharge: parsed.serviceCharge,
      vat: parsed.vat,
      disasterFund: parsed.disasterFund,
      balanceAfter: parsed.balanceAfter,
      counterparty: parsed.counterparty,
      referenceNo: parsed.referenceNo,
      date: parsed.date,
      rawSms: parsed.rawSms,
      smsTimestamp: parsed.smsTimestamp,
      source: 'sms',
    });

    if (!txnId) {
      result.skippedDuplicates++;
      continue;
    }

    result.newTransactions++;

    // Insert balance snapshot
    await insertBalanceSnapshot(db, {
      accountId,
      balance: parsed.balanceAfter,
      recordedAt: parsed.date,
      source: 'sms',
    });

    // Check for balance reconciliation gaps
    const gap = await checkReconciliation(db, {
      id: txnId,
      accountId,
      type: parsed.type,
      amount: parsed.amount,
      totalAmount: parsed.totalAmount,
      balanceAfter: parsed.balanceAfter,
      date: parsed.date,
      smsTimestamp: parsed.smsTimestamp,
    });

    if (gap) {
      result.gaps++;
    }

    // Auto-categorize
    const categoryId = await autoCategorize(db, parsed.counterparty, parsed.rawSms);
    if (categoryId) {
      await updateTransactionCategory(db, txnId, categoryId);
    }

    // Track newest timestamp
    if (sms.date > newestTimestamp) {
      newestTimestamp = sms.date;
    }
  }

  // Update sync state
  if (newestTimestamp > lastSyncedAt) {
    if (syncState.length === 0) {
      await db.insert(smsSyncState).values({ id: 1, lastSyncedAt: newestTimestamp });
    } else {
      await db.update(smsSyncState).set({ lastSyncedAt: newestTimestamp }).where(eq(smsSyncState.id, 1));
    }
  }

  return result;
}
