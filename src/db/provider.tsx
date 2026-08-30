import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { seedDefaultCategories } from './seed';

const DB_NAME = 'budget_tracker.db';

type Database = ReturnType<typeof drizzle<typeof schema>>;

const DatabaseContext = createContext<Database | null>(null);

export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return db;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      const sqlite = SQLite.openDatabaseSync(DB_NAME);
      const database = drizzle(sqlite, { schema });

      // Run migrations inline (create tables if they don't exist)
      await sqlite.execAsync(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          bank TEXT NOT NULL,
          account_number TEXT NOT NULL,
          label TEXT,
          latest_balance REAL,
          latest_balance_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS accounts_bank_number_idx ON accounts(bank, account_number);

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          icon TEXT,
          type TEXT NOT NULL DEFAULT 'expense',
          is_default INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES accounts(id),
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          total_amount REAL,
          service_charge REAL DEFAULT 0,
          vat REAL DEFAULT 0,
          disaster_fund REAL DEFAULT 0,
          balance_after REAL,
          counterparty TEXT,
          reference_no TEXT,
          category_id TEXT REFERENCES categories(id),
          date TEXT NOT NULL,
          raw_sms TEXT,
          sms_timestamp INTEGER,
          source TEXT NOT NULL DEFAULT 'sms',
          is_reconciled INTEGER NOT NULL DEFAULT 1,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS transactions_ref_account_idx ON transactions(reference_no, account_id);

        CREATE TABLE IF NOT EXISTS balance_snapshots (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES accounts(id),
          balance REAL NOT NULL,
          recorded_at TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'sms'
        );

        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY,
          category_id TEXT NOT NULL REFERENCES categories(id),
          month TEXT NOT NULL,
          limit_amount REAL NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS budgets_category_month_idx ON budgets(category_id, month);

        CREATE TABLE IF NOT EXISTS categorization_rules (
          id TEXT PRIMARY KEY,
          keyword TEXT NOT NULL,
          category_id TEXT NOT NULL REFERENCES categories(id),
          priority INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS reconciliation_gaps (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES accounts(id),
          expected_balance REAL NOT NULL,
          actual_balance REAL NOT NULL,
          gap_amount REAL NOT NULL,
          detected_at TEXT NOT NULL,
          resolved INTEGER NOT NULL DEFAULT 0,
          resolved_transaction_id TEXT REFERENCES transactions(id),
          transaction_before_id TEXT REFERENCES transactions(id),
          transaction_after_id TEXT REFERENCES transactions(id)
        );

        CREATE TABLE IF NOT EXISTS sms_sync_state (
          id INTEGER PRIMARY KEY DEFAULT 1,
          last_synced_at INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS loans (
          id TEXT PRIMARY KEY,
          person TEXT NOT NULL,
          direction TEXT NOT NULL,
          principal REAL NOT NULL,
          note TEXT,
          start_date TEXT NOT NULL,
          due_date TEXT,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS loan_payments (
          id TEXT PRIMARY KEY,
          loan_id TEXT NOT NULL REFERENCES loans(id),
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          note TEXT
        );
      `);

      // v1.1 column additions for databases created before them (no-op if present)
      try { await sqlite.execAsync('ALTER TABLE categories ADD COLUMN color TEXT'); } catch {}
      try { await sqlite.execAsync('ALTER TABLE transactions ADD COLUMN loan_id TEXT'); } catch {}

      // Seed default categories
      await seedDefaultCategories(database);

      setDb(database);
      setIsReady(true);
    }

    init().catch(console.error);
  }, []);

  if (!isReady || !db) {
    return null; // Or a loading spinner
  }

  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
}
