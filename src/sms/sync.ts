import { eq } from 'drizzle-orm';
import { parseSms, isFromKnownBank } from './dispatcher';
import { readSmsInbox, getMockSmsData } from './reader';
import { RawSms } from './types';
import { upsertAccount, getAccountsByBank, getAllAccounts } from '@/src/db/repository/accounts';
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

/** Visible digit tail of an account number: "1***1807" → "1807", full numbers unchanged. */
function accountDigitTail(accountNumber: string): string {
  const parts = accountNumber.split(/\*+/);
  return parts[parts.length - 1] ?? '';
}

/**
 * If a parsed transaction carries the other side's full account/phone number,
 * check it against the user's own accounts — a suffix match (≥4 digits) means
 * this is a transfer between the user's own accounts across banks, e.g.
 * telebirr → own CBE ("...account number 1000495221807" vs mask "1***1807").
 * Returns the own-transfer counterparty label, or null.
 */
async function resolveOwnTransferLabel(
  db: any,
  counterpartyAccountNo: string,
  ownAccountId: string
): Promise<string | null> {
  const allAccounts = await getAllAccounts(db);
  for (const acct of allAccounts) {
    if (acct.id === ownAccountId) continue;
    const tail = accountDigitTail(acct.accountNumber);
    if (tail.length < 4 || counterpartyAccountNo.length < 4) continue;
    if (counterpartyAccountNo.endsWith(tail) || tail.endsWith(counterpartyAccountNo)) {
      return `Own account ${acct.accountNumber}`;
    }
  }
  return null;
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

    // Resolve account number — if parser couldn't extract it, look up existing account for this bank
    let accountNumber: string;
    if (parsed.accountNumber) {
      accountNumber = parsed.accountNumber;
    } else {
      const bankAccounts = await getAccountsByBank(db, parsed.bank);
      if (bankAccounts.length === 1) {
        accountNumber = bankAccounts[0].accountNumber;
      } else {
        // Can't determine which account — skip this SMS
        result.parseErrors++;
        continue;
      }
    }

    // Upsert account
    const accountId = await upsertAccount(db, {
      bank: parsed.bank,
      accountNumber,
      latestBalance: parsed.balanceAfter,
      latestBalanceAt: parsed.date,
    });

    // Cross-bank own transfer? Relabel so it reads (and aggregates) like the
    // in-bank "Own account X" legs the parsers label directly.
    let counterparty = parsed.counterparty;
    if (parsed.counterpartyAccountNo && !counterparty?.startsWith('Own account')) {
      const ownLabel = await resolveOwnTransferLabel(db, parsed.counterpartyAccountNo, accountId);
      if (ownLabel) counterparty = ownLabel;
    }

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
      counterparty,
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
    const categoryId = await autoCategorize(db, counterparty, parsed.rawSms);
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
