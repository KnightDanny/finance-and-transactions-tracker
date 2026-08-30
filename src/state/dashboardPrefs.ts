import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'dashboard_prefs';

export type DashboardSectionKey =
  | 'showNetWorth'
  | 'showLoans'
  | 'showGaps'
  | 'showSummary'
  | 'showSpendingPie'
  | 'showBudgets'
  | 'showAccounts'
  | 'showRecent';

export type DashboardPrefs = Record<DashboardSectionKey, boolean>;

export const SECTION_META: Record<DashboardSectionKey, { label: string; description: string }> = {
  showNetWorth: { label: 'Net worth', description: 'Cash + lent − borrowed' },
  showAccounts: { label: 'Accounts', description: 'Bank groups and balances' },
  showLoans: { label: 'Loans', description: 'You get / you owe, quick add' },
  showGaps: { label: 'Balance gaps banner', description: 'Unresolved reconciliation gaps' },
  showSummary: { label: 'Monthly summary', description: 'Income and expense cards' },
  showSpendingPie: { label: 'Spending by category', description: 'Category breakdown chart' },
  showBudgets: { label: 'Budgets', description: 'Compact budget progress' },
  showRecent: { label: 'Recent transactions', description: 'Latest five ledger entries' },
};

export const DEFAULT_ORDER: DashboardSectionKey[] = [
  'showNetWorth',
  'showAccounts',
  'showLoans',
  'showGaps',
  'showSummary',
  'showSpendingPie',
  'showBudgets',
  'showRecent',
];

const DEFAULTS: DashboardPrefs = {
  showNetWorth: true,
  showLoans: true,
  showGaps: true,
  showSummary: true,
  showSpendingPie: true,
  showBudgets: true,
  showAccounts: true,
  showRecent: true,
};

/** Keep only known keys, drop duplicates, append any sections added since the prefs were saved. */
function sanitizeOrder(saved: unknown): DashboardSectionKey[] {
  const order = Array.isArray(saved)
    ? (saved.filter((k, i) => DEFAULT_ORDER.includes(k) && saved.indexOf(k) === i) as DashboardSectionKey[])
    : [];
  for (const key of DEFAULT_ORDER) if (!order.includes(key)) order.push(key);
  return order;
}

interface DashboardPrefsState extends DashboardPrefs {
  order: DashboardSectionKey[];
  toggle: (key: DashboardSectionKey) => void;
  setOrder: (order: DashboardSectionKey[]) => void;
}

function persist(state: DashboardPrefsState) {
  const toSave: DashboardPrefs & { order: DashboardSectionKey[] } = {
    showNetWorth: state.showNetWorth,
    showLoans: state.showLoans,
    showGaps: state.showGaps,
    showSummary: state.showSummary,
    showSpendingPie: state.showSpendingPie,
    showBudgets: state.showBudgets,
    showAccounts: state.showAccounts,
    showRecent: state.showRecent,
    order: state.order,
  };
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
}

/** Which sections the Home dashboard renders and in what order — user-customizable, persisted. */
export const useDashboardPrefs = create<DashboardPrefsState>((set, get) => ({
  ...DEFAULTS,
  order: DEFAULT_ORDER,
  toggle: (key) => {
    set({ [key]: !get()[key] } as Partial<DashboardPrefsState>);
    persist(get());
  },
  setOrder: (order) => {
    set({ order: sanitizeOrder(order) });
    persist(get());
  },
}));

SecureStore.getItemAsync(STORAGE_KEY)
  .then((v) => {
    if (!v) return;
    try {
      const saved = JSON.parse(v);
      useDashboardPrefs.setState({ ...DEFAULTS, ...saved, order: sanitizeOrder(saved.order) });
    } catch {}
  })
  .catch(() => {});
