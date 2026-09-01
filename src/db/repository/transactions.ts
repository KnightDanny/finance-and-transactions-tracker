import { eq, and, desc, gte, lte, lt, sql, inArray, isNull, isNotNull, notLike, like, or } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { transactions, accounts, categories, transactionSplits } from '../schema';
import { FEES_CATEGORY_NAME } from '../seed';
import { getRateMap } from './rates';

type Database = any;

/**
 * Excludes transfers between the user's own accounts from income/expense
 * aggregates — moving your own money is not earning or spending. Parsers and
 * sync label such legs with a counterparty starting "Own account".
 * (NULL check required: SQL `NULL NOT LIKE x` is NULL, which would drop
 * counterparty-less rows from the aggregates.)
 */
const notOwnTransfer = or(
  isNull(transactions.counterparty),
  notLike(transactions.counterparty, 'Own account%')
);

/**
 * Excludes user-marked transfer pairs (P2P trades, manual own-transfers):
 * both legs carry the same transfer_pair_id and count as moving money, not
 * income or expense.
 */
const notTransferPair = isNull(transactions.transferPairId);

/**
 * Bank/telebirr charges are real spending even on transfers (the principal of
 * a transfer moves between own accounts; the fee leaves). Summed across ALL
 * debits in range — transfer or not — and reported under the Transaction Fees
 * category.
 */
async function sumFees(db: Database, startDate: string, endDate: string): Promise<number> {
  const [row] = await db
    .select({
      fees: sql<number>`COALESCE(SUM(
        COALESCE(${transactions.serviceCharge}, 0) +
        COALESCE(${transactions.vat}, 0) +
        COALESCE(${transactions.disasterFund}, 0)
      ), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'debit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        etbAccountsOnly
      )
    );
  return row?.fees ?? 0;
}

/**
 * P2P trade profit: within a marked transfer pair, if the incoming leg is
 * worth MORE in ETB (at saved rates) than the outgoing leg, the surplus is
 * real income (favorable P2P rate), attributed to the credit leg's date.
 * Pairs with an unrated currency are skipped — a missing rate would fabricate
 * profit. Losses are ignored (moving money at a bad rate isn't spending).
 */
export async function getPairProfits(
  db: Database,
  startDate: string,
  endDate: string
): Promise<Array<{ pairId: string; date: string; profit: number }>> {
  const rows = await db
    .select({
      pairId: transactions.transferPairId,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      currency: accounts.currency,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(isNotNull(transactions.transferPairId));

  const rates = await getRateMap(db);
  const byPair = new Map<string, any[]>();
  for (const r of rows) {
    if (!byPair.has(r.pairId)) byPair.set(r.pairId, []);
    byPair.get(r.pairId)!.push(r);
  }

  const profits: Array<{ pairId: string; date: string; profit: number }> = [];
  for (const [pairId, legs] of byPair) {
    const credit = legs.find((l) => l.type === 'credit');
    const debit = legs.find((l) => l.type === 'debit');
    if (!credit || !debit) continue;
    if (credit.date < startDate || credit.date > endDate) continue;
    const creditRate = rates[credit.currency ?? 'ETB'];
    const debitRate = rates[debit.currency ?? 'ETB'];
    if (creditRate == null || debitRate == null) continue;
    const profit = credit.amount * creditRate - debit.amount * debitRate;
    if (profit > 0.005) profits.push({ pairId, date: credit.date, profit });
  }
  return profits;
}

/**
 * Category deltas from splits: each split moves its amount from the parent
 * transaction's category bucket into its own (a loan split's bucket is
 * "Uncategorized"). The remainder stays with the parent automatically. Same
 * filters as the spending aggregates so the parent was actually counted.
 */
async function getSplitAdjustments(
  db: Database,
  startDate: string,
  endDate: string
): Promise<Array<{ parentCategoryId: string | null; categoryId: string | null; amount: number }>> {
  return db
    .select({
      parentCategoryId: transactions.categoryId,
      categoryId: transactionSplits.categoryId,
      amount: transactionSplits.amount,
    })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.type, 'debit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        notOwnTransfer,
        notTransferPair,
        etbAccountsOnly
      )
    );
}

async function getFeesCategoryId(db: Database): Promise<string | null> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, FEES_CATEGORY_NAME));
  return row?.id ?? null;
}

/**
 * ETB summaries must not add foreign-currency amounts raw — a 500 USDT deposit
 * is not ETB 500 of income. Aggregates therefore only count transactions on
 * ETB accounts; foreign holdings enter net worth via the rate conversion in
 * getTotalNetWorth instead.
 */
const etbAccountsOnly = sql`${transactions.accountId} IN (
  SELECT id FROM accounts WHERE COALESCE(currency, 'ETB') = 'ETB'
)`;

/** How many transactions are dated before `isoDate` (YYYY-MM-DD). */
export async function countTransactionsBefore(db: Database, isoDate: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(lt(transactions.date, isoDate));
  return row?.n ?? 0;
}

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
  source?: 'sms' | 'email' | 'manual' | 'reconciliation';
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
      transferPairId: transactions.transferPairId,
      hasSplits: sql<number>`EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id = ${transactions.id})`,
      bank: accounts.bank,
      accountNumber: accounts.accountNumber,
      accountLabel: accounts.label,
      currency: accounts.currency,
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
    /** Match transactions on ANY of these accounts (ledger account filter). */
    accountIds?: string[];
    type?: 'credit' | 'debit';
    categoryId?: string;
    categoryIds?: string[];
    startDate?: string;
    endDate?: string;
    /** Free-text match on counterparty, reference, note, category name, or amount. */
    search?: string;
    minAmount?: number;
    maxAmount?: number;
    /** Match rows whose counterparty contains ANY of these strings. */
    counterpartyLike?: string[];
    /** Only transactions marked as loans (loan_id set). */
    hasLoan?: boolean;
    limit?: number;
  }
) {
  const conditions = [];

  if (filters.accountIds && filters.accountIds.length > 0) {
    conditions.push(inArray(transactions.accountId, filters.accountIds));
  } else if (filters.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    // A transaction matches a category directly, via one of the category's
    // subcategories, or through one of its splits (either level)
    const childIds = db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.parentId, filters.categoryIds));
    conditions.push(
      or(
        inArray(transactions.categoryId, filters.categoryIds),
        inArray(transactions.categoryId, childIds),
        inArray(
          transactions.id,
          db
            .select({ id: transactionSplits.transactionId })
            .from(transactionSplits)
            .where(
              or(
                inArray(transactionSplits.categoryId, filters.categoryIds),
                inArray(transactionSplits.categoryId, childIds)
              )
            )
        )
      )!
    );
  } else if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(transactions.date, filters.endDate));
  if (filters.minAmount != null) conditions.push(gte(transactions.amount, filters.minAmount));
  if (filters.maxAmount != null) conditions.push(lte(transactions.amount, filters.maxAmount));
  if (filters.counterpartyLike && filters.counterpartyLike.length > 0) {
    conditions.push(
      or(...filters.counterpartyLike.map((p) => like(transactions.counterparty, `%${p}%`)))!
    );
  }
  if (filters.hasLoan) {
    // Whole-transaction loans, or a loan carved out via a split
    conditions.push(
      or(
        isNotNull(transactions.loanId),
        inArray(
          transactions.id,
          db
            .select({ id: transactionSplits.transactionId })
            .from(transactionSplits)
            .where(isNotNull(transactionSplits.loanId))
        )
      )!
    );
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    // LIKE is case-insensitive for ASCII in SQLite; category name lives on the
    // joined table, which the where clause sees since it's applied post-join
    conditions.push(
      or(
        like(transactions.counterparty, q),
        like(transactions.referenceNo, q),
        like(transactions.note, q),
        like(categories.name, q),
        sql`CAST(${transactions.amount} AS TEXT) LIKE ${q}`
      )!
    );
  }

  let query = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      amount: transactions.amount,
      totalAmount: transactions.totalAmount,
      serviceCharge: transactions.serviceCharge,
      vat: transactions.vat,
      disasterFund: transactions.disasterFund,
      balanceAfter: transactions.balanceAfter,
      counterparty: transactions.counterparty,
      referenceNo: transactions.referenceNo,
      categoryId: transactions.categoryId,
      date: transactions.date,
      source: transactions.source,
      smsTimestamp: transactions.smsTimestamp,
      note: transactions.note,
      transferPairId: transactions.transferPairId,
      hasSplits: sql<number>`EXISTS(SELECT 1 FROM transaction_splits WHERE transaction_id = ${transactions.id})`,
      bank: accounts.bank,
      accountNumber: accounts.accountNumber,
      accountLabel: accounts.label,
      currency: accounts.currency,
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

/** Link two transactions as one transfer (P2P trade or own-account move):
 * both get the same pair id and stop counting as income/expense. */
export async function markTransferPair(db: Database, txnIdA: string, txnIdB: string): Promise<string> {
  const pairId = uuid();
  await db.update(transactions).set({ transferPairId: pairId })
    .where(inArray(transactions.id, [txnIdA, txnIdB]));
  return pairId;
}

/** Undo markTransferPair — both legs return to normal income/expense. */
export async function unmarkTransferPair(db: Database, pairId: string) {
  await db.update(transactions).set({ transferPairId: null })
    .where(eq(transactions.transferPairId, pairId));
}

/** The other leg of a marked pair. */
export async function getPairedTransaction(db: Database, pairId: string, excludeId: string) {
  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      counterparty: transactions.counterparty,
      bank: accounts.bank,
      accountLabel: accounts.label,
      accountNumber: accounts.accountNumber,
      currency: accounts.currency,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(eq(transactions.transferPairId, pairId));
  return rows.find((r: any) => r.id !== excludeId) ?? null;
}

/**
 * Candidate counterpart legs for pairing with `txn`: opposite type, a
 * different account, not already paired, dated within a few days — nearest
 * first. Cross-currency welcome (a P2P trade's legs differ in amount).
 */
export async function getTransferCandidates(db: Database, txn: { id: string; type: string; date: string }) {
  const windowDays = 6 * 86400000;
  const center = new Date(`${txn.date}T00:00:00`).getTime();
  const fromIso = new Date(center - windowDays).toISOString().split('T')[0];
  const toIso = new Date(center + windowDays).toISOString().split('T')[0];
  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      counterparty: transactions.counterparty,
      bank: accounts.bank,
      accountLabel: accounts.label,
      accountNumber: accounts.accountNumber,
      currency: accounts.currency,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.type, txn.type === 'credit' ? 'debit' : 'credit'),
        isNull(transactions.transferPairId),
        gte(transactions.date, fromIso),
        lte(transactions.date, toIso)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.smsTimestamp))
    .limit(60);
  return rows.sort(
    (a: any, b: any) =>
      Math.abs(new Date(`${a.date}T00:00:00`).getTime() - center) -
      Math.abs(new Date(`${b.date}T00:00:00`).getTime() - center)
  );
}

/**
 * Auto-pair the two legs of local own-account transfers. Anchors on legs the
 * parsers identified as own transfers (counterparty "Own account …") — the
 * OTHER leg often carries no label at all (a CBE credit from telebirr names
 * nobody), so counterparts come from every unpaired opposite-type row. To
 * avoid gluing a coincidental same-amount payment to a transfer, a
 * counterpart must land on the account the anchor's label names (last-4-digit
 * match) whenever the label carries digits; only digit-less labels fall back
 * to amount + time alone. Idempotent. Returns pairs made.
 */
export async function autoPairOwnTransfers(db: Database): Promise<number> {
  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      smsTimestamp: transactions.smsTimestamp,
      counterparty: transactions.counterparty,
      accountNumber: accounts.accountNumber,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(isNull(transactions.transferPairId));

  const isOwn = (r: any) => r.counterparty?.startsWith('Own account');
  const last4 = (s: string | null | undefined) => {
    const digits = (s ?? '').replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : null;
  };
  const time = (r: any) => r.smsTimestamp ?? new Date(`${r.date}T00:00:00`).getTime();

  const anchors = rows.filter(isOwn);
  const used = new Set<string>();
  let pairs = 0;

  for (const a of anchors) {
    if (used.has(a.id)) continue;
    const hint = last4(a.counterparty); // account the label points at
    let best: any = null;
    let bestScore = -1;
    let bestGap = Infinity;
    for (const c of rows) {
      if (used.has(c.id) || c.id === a.id) continue;
      if (c.type === a.type || c.accountId === a.accountId || c.amount !== a.amount) continue;
      const gap = Math.abs(time(c) - time(a));
      if (gap > 86400000) continue;
      const acctMatch = hint !== null && last4(c.accountNumber) === hint;
      if (hint !== null && !acctMatch && !isOwn(c)) continue; // labeled anchor must hit the named account
      const score = (acctMatch ? 2 : 0) + (isOwn(c) ? 1 : 0);
      if (score > bestScore || (score === bestScore && gap < bestGap)) {
        best = c;
        bestScore = score;
        bestGap = gap;
      }
    }
    if (best) {
      used.add(a.id);
      used.add(best.id);
      await markTransferPair(db, a.id, best.id);
      pairs++;
    }
  }
  return pairs;
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

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'debit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        notOwnTransfer,
        notTransferPair,
        etbAccountsOnly
      )
    )
    .groupBy(transactions.categoryId);

  // Splits re-attribute part of the parent's amount to their own category
  const adjustments = await getSplitAdjustments(db, startDate, endDate);
  const bump = (categoryId: string | null, delta: number) => {
    const r = rows.find((x: any) => x.categoryId === categoryId);
    if (r) r.total += delta;
    else rows.push({ categoryId, total: delta });
  };
  for (const a of adjustments) {
    bump(a.parentCategoryId, -a.amount);
    bump(a.categoryId, a.amount);
  }

  // Charges across ALL debits (transfers included) land on Transaction Fees
  const [fees, feesCategoryId] = await Promise.all([
    sumFees(db, startDate, endDate),
    getFeesCategoryId(db),
  ]);
  if (fees > 0 && feesCategoryId) {
    const existing = rows.find((r: any) => r.categoryId === feesCategoryId);
    if (existing) existing.total += fees;
    else rows.push({ categoryId: feesCategoryId, total: fees });
  }
  return rows;
}

export async function getSpendingSummary(
  db: Database,
  startDate: string,
  endDate: string
): Promise<{ totalIncome: number; totalExpense: number; incomeCount: number; expenseCount: number }> {
  const incomeResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'credit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        notOwnTransfer,
        notTransferPair,
        etbAccountsOnly
      )
    );

  const expenseResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'debit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        notOwnTransfer,
        notTransferPair,
        etbAccountsOnly
      )
    );

  // Fees on every debit — transfers included — are spending; P2P surpluses
  // (in-leg worth more than out-leg at saved rates) are income
  const [fees, pairProfits] = await Promise.all([
    sumFees(db, startDate, endDate),
    getPairProfits(db, startDate, endDate),
  ]);
  const profit = pairProfits.reduce((s, p) => s + p.profit, 0);

  return {
    totalIncome: (incomeResult[0]?.total ?? 0) + profit,
    totalExpense: (expenseResult[0]?.total ?? 0) + fees,
    incomeCount: incomeResult[0]?.count ?? 0,
    expenseCount: expenseResult[0]?.count ?? 0,
  };
}

export async function getSpendingByCategory(
  db: Database,
  startDate: string,
  endDate: string
): Promise<Array<{ categoryId: string | null; categoryName: string; categoryIcon: string | null; total: number; count: number }>> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      total: sql<number>`SUM(${transactions.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.type, 'debit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        notOwnTransfer,
        notTransferPair,
        etbAccountsOnly
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(sql`SUM(${transactions.amount}) DESC`);

  // Splits re-attribute part of the parent's amount to their own category
  const adjustments = await getSplitAdjustments(db, startDate, endDate);
  if (adjustments.length > 0) {
    const meta = new Map((await db.select().from(categories)).map((c: any) => [c.id, c]));
    const bump = (categoryId: string | null, delta: number) => {
      let r = rows.find((x: any) => x.categoryId === categoryId);
      if (!r) {
        const m: any = categoryId ? meta.get(categoryId) : null;
        r = {
          categoryId,
          categoryName: m?.name ?? 'Uncategorized',
          categoryIcon: m?.icon ?? null,
          categoryColor: m?.color ?? null,
          total: 0,
          count: 0,
        } as any;
        rows.push(r);
      }
      r!.total += delta;
    };
    for (const a of adjustments) {
      bump(a.parentCategoryId, -a.amount);
      bump(a.categoryId, a.amount);
    }
  }

  // Charges across ALL debits (transfers included) show as Transaction Fees
  const [fees, feesCategoryId] = await Promise.all([
    sumFees(db, startDate, endDate),
    getFeesCategoryId(db),
  ]);
  if (fees > 0 && feesCategoryId) {
    const existing = rows.find((r: any) => r.categoryId === feesCategoryId);
    if (existing) {
      existing.total += fees;
    } else {
      rows.push({
        categoryId: feesCategoryId,
        categoryName: FEES_CATEGORY_NAME,
        categoryIcon: '🧾',
        categoryColor: null,
        total: fees,
        count: 0,
      } as any);
    }
  }
  // Buckets fully emptied by split re-attribution drop out
  return rows.filter((r: any) => r.total > 0.004).sort((a: any, b: any) => b.total - a.total);
}
