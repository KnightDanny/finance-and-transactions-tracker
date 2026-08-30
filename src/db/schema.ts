import { sqliteTable, text, real, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ── Accounts ──────────────────────────────────────────────
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  bank: text('bank').notNull(), // 'CBE' | 'TELEBIRR'
  accountNumber: text('account_number').notNull(),
  label: text('label'),
  latestBalance: real('latest_balance'),
  latestBalanceAt: text('latest_balance_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
}, (table) => [
  uniqueIndex('accounts_bank_number_idx').on(table.bank, table.accountNumber),
]);

// ── Categories ────────────────────────────────────────────
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  icon: text('icon'), // emoji character
  color: text('color'), // '#RRGGBB', optional — pie/legend tint
  type: text('type').notNull().default('expense'), // 'expense' | 'income'
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
});

// ── Transactions ──────────────────────────────────────────
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  type: text('type').notNull(), // 'credit' | 'debit'
  amount: real('amount').notNull(),
  totalAmount: real('total_amount'),
  serviceCharge: real('service_charge').default(0),
  vat: real('vat').default(0),
  disasterFund: real('disaster_fund').default(0),
  balanceAfter: real('balance_after'),
  counterparty: text('counterparty'),
  referenceNo: text('reference_no'),
  categoryId: text('category_id').references(() => categories.id),
  date: text('date').notNull(), // ISO date
  rawSms: text('raw_sms'),
  smsTimestamp: integer('sms_timestamp'),
  source: text('source').notNull().default('sms'), // 'sms' | 'manual' | 'reconciliation'
  isReconciled: integer('is_reconciled', { mode: 'boolean' }).notNull().default(true),
  note: text('note'),
  // Set when the user marks this transaction as a loan: credit → borrowed,
  // debit → lent. The loan record is created from the transaction.
  loanId: text('loan_id'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
}, (table) => [
  uniqueIndex('transactions_ref_account_idx').on(table.referenceNo, table.accountId),
]);

// ── Balance Snapshots ─────────────────────────────────────
export const balanceSnapshots = sqliteTable('balance_snapshots', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  balance: real('balance').notNull(),
  recordedAt: text('recorded_at').notNull(),
  source: text('source').notNull().default('sms'),
});

// ── Budgets ───────────────────────────────────────────────
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  month: text('month').notNull(), // 'YYYY-MM'
  limitAmount: real('limit_amount').notNull(),
}, (table) => [
  uniqueIndex('budgets_category_month_idx').on(table.categoryId, table.month),
]);

// ── Categorization Rules ──────────────────────────────────
export const categorizationRules = sqliteTable('categorization_rules', {
  id: text('id').primaryKey(),
  keyword: text('keyword').notNull(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  priority: integer('priority').notNull().default(0),
});

// ── Reconciliation Gaps ───────────────────────────────────
export const reconciliationGaps = sqliteTable('reconciliation_gaps', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  expectedBalance: real('expected_balance').notNull(),
  actualBalance: real('actual_balance').notNull(),
  gapAmount: real('gap_amount').notNull(),
  detectedAt: text('detected_at').notNull(),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  resolvedTransactionId: text('resolved_transaction_id').references(() => transactions.id),
  transactionBeforeId: text('transaction_before_id').references(() => transactions.id),
  transactionAfterId: text('transaction_after_id').references(() => transactions.id),
});

// ── SMS Sync State ────────────────────────────────────────
export const smsSyncState = sqliteTable('sms_sync_state', {
  id: integer('id').primaryKey().default(1),
  lastSyncedAt: integer('last_synced_at').notNull().default(0),
});

// ── Loans (money lent to / borrowed from people) ──────────
export const loans = sqliteTable('loans', {
  id: text('id').primaryKey(),
  person: text('person').notNull(),
  direction: text('direction').notNull(), // 'lent' | 'borrowed'
  principal: real('principal').notNull(),
  note: text('note'),
  startDate: text('start_date').notNull(), // ISO date
  dueDate: text('due_date'), // ISO date, optional
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ── Loan Payments (repayments/collections against a loan) ─
export const loanPayments = sqliteTable('loan_payments', {
  id: text('id').primaryKey(),
  loanId: text('loan_id').notNull().references(() => loans.id),
  amount: real('amount').notNull(),
  date: text('date').notNull(), // ISO date
  note: text('note'),
});
