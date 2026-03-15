import { create } from 'zustand';
import * as authStorage from './storage';
import * as biometric from './biometric';

interface AuthState {
  isPasscodeSet: boolean;
  isBiometricEnabled: boolean;
  lockTimeoutSeconds: number;
  isLocked: boolean;
  isReady: boolean;

  initialize: () => void;
  setupPasscode: (pin: string) => Promise<void>;
  verifyPasscode: (pin: string) => Promise<boolean>;
  changePasscode: (oldPin: string, newPin: string) => Promise<boolean>;
  removePasscode: () => Promise<void>;
  toggleBiometric: (enabled: boolean) => Promise<void>;
  setLockTimeout: (seconds: number) => void;
  unlock: () => void;
  lock: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isPasscodeSet: false,
  isBiometricEnabled: false,
  lockTimeoutSeconds: 0,
  isLocked: true,
  isReady: false,

  initialize: () => {
    const config = authStorage.loadAuthConfig();
    set({
      ...config,
      isLocked: config.isPasscodeSet,
      isReady: true,
    });
  },

  setupPasscode: async (pin) => {
    await authStorage.savePasscode(pin);
    set({ isPasscodeSet: true });
  },

  verifyPasscode: async (pin) => {
    return authStorage.verifyPasscode(pin);
  },

  changePasscode: async (oldPin, newPin) => {
    const valid = await authStorage.verifyPasscode(oldPin);
    if (!valid) return false;
    await authStorage.savePasscode(newPin);
    return true;
  },

  removePasscode: async () => {
    await authStorage.clearPasscode();
    set({ isPasscodeSet: false, isBiometricEnabled: false, isLocked: false });
  },

  toggleBiometric: async (enabled) => {
    if (enabled) {
      const available = await biometric.isBiometricAvailable();
      if (!available) throw new Error('Biometric authentication not available on this device');
    }
    authStorage.saveBiometricEnabled(enabled);
    set({ isBiometricEnabled: enabled });
  },

  setLockTimeout: (seconds) => {
    authStorage.saveLockTimeout(seconds);
    set({ lockTimeoutSeconds: seconds });
  },

  unlock: () => set({ isLocked: false }),
  lock: () => {
    if (get().isPasscodeSet) {
      set({ isLocked: true });
    }
  },
}));
