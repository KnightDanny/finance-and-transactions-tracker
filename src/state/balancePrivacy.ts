import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'balances_hidden';

interface BalancePrivacyState {
  hidden: boolean;
  toggle: () => void;
}

/**
 * Global "hide balances" switch — the eye on the Home hero. Masks the total
 * balance and every account balance. Persisted so the choice survives restarts.
 */
export const useBalancePrivacy = create<BalancePrivacyState>((set, get) => ({
  hidden: false,
  toggle: () => {
    const next = !get().hidden;
    set({ hidden: next });
    SecureStore.setItemAsync(STORAGE_KEY, next ? '1' : '0').catch(() => {});
  },
}));

// Hydrate persisted choice on module load
SecureStore.getItemAsync(STORAGE_KEY)
  .then((v) => {
    if (v === '1') useBalancePrivacy.setState({ hidden: true });
  })
  .catch(() => {});

/** Mask used wherever a balance is hidden. */
export const MASKED = '••••••';
