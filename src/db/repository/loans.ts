import { eq, sql } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { loans, loanPayments, transactions } from '../schema';

type Database = any;

export interface LoanWithProgress {
  id: string;
  person: string;
  direction: 'lent' | 'borrowed';
  principal: number;
  note: string | null;
  startDate: string;
  dueDate: string | null;
  archived: boolean;
  paid: number;      // sum of recorded payments
  remaining: number; // principal − paid, floored at 0
}

export async function getLoans(db: Database, includeArchived = false): Promise<LoanWithProgress[]> {
  const rows = await db.all(sql`
    SELECT l.id, l.person, l.direction, l.principal, l.note,
           l.start_date AS startDate, l.due_date AS dueDate, l.archived,
           COALESCE(SUM(p.amount), 0) AS paid
    FROM loans l
    LEFT JOIN loan_payments p ON p.loan_id = l.id
    ${includeArchived ? sql`` : sql`WHERE l.archived = 0`}
    GROUP BY l.id
    ORDER BY l.due_date IS NULL, l.due_date ASC, l.start_date DESC
  `);
  return (rows as any[]).map((r) => ({
    ...r,
    archived: !!r.archived,
    remaining: Math.max(0, r.principal - r.paid),
  }));
}

/** Outstanding totals: how much others owe you (lent) and you owe others (borrowed). */
export async function getLoanTotals(db: Database): Promise<{ lentOutstanding: number; borrowedOutstanding: number }> {
  const rows = await getLoans(db, false);
  let lentOutstanding = 0;
  let borrowedOutstanding = 0;
  for (const l of rows) {
    if (l.direction === 'lent') lentOutstanding += l.remaining;
    else borrowedOutstanding += l.remaining;
  }
  return { lentOutstanding, borrowedOutstanding };
}

export async function createLoan(db: Database, data: {
  person: string;
  direction: 'lent' | 'borrowed';
  principal: number;
  note?: string;
  startDate: string;
  dueDate?: string;
}): Promise<string> {
  const id = uuid();
  await db.insert(loans).values({
    id,
    person: data.person,
    direction: data.direction,
    principal: data.principal,
    note: data.note,
    startDate: data.startDate,
    dueDate: data.dueDate,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function addLoanPayment(db: Database, loanId: string, amount: number, date: string, note?: string) {
  await db.insert(loanPayments).values({ id: uuid(), loanId, amount, date, note });
}

export async function getLoanPayments(db: Database, loanId: string) {
  return db.select().from(loanPayments).where(eq(loanPayments.loanId, loanId)).orderBy(sql`date DESC`);
}

export async function setLoanArchived(db: Database, id: string, archived: boolean) {
  await db.update(loans).set({ archived }).where(eq(loans.id, id));
}

export async function deleteLoan(db: Database, id: string) {
  await db.delete(loanPayments).where(eq(loanPayments.loanId, id));
  await db.delete(loans).where(eq(loans.id, id));
  // A transaction marked as this loan loses its link (stays a normal transaction)
  await db.update(transactions).set({ loanId: null }).where(eq(transactions.loanId, id));
}

/**
 * Mark a transaction as a loan: money that came IN was borrowed, money that
 * went OUT was lent. Creates the loan from the transaction's own fields and
 * links the two. Returns the new loan id.
 */
export async function markTransactionAsLoan(
  db: Database,
  txn: { id: string; type: string; amount: number; counterparty?: string | null; date: string }
): Promise<string> {
  const loanId = await createLoan(db, {
    person: txn.counterparty?.trim() || 'Unknown',
    direction: txn.type === 'credit' ? 'borrowed' : 'lent',
    principal: txn.amount,
    startDate: txn.date,
    note: 'Marked from transaction',
  });
  await db.update(transactions).set({ loanId }).where(eq(transactions.id, txn.id));
  return loanId;
}

/** Undo markTransactionAsLoan: unlink and remove the loan it created. */
export async function unmarkTransactionAsLoan(db: Database, txnId: string, loanId: string) {
  await db.update(transactions).set({ loanId: null }).where(eq(transactions.id, txnId));
  await deleteLoan(db, loanId);
}
