import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Storage } from 'expo-sqlite/kv-store';

const KEYS = {
  PASSCODE_HASH: 'auth_passcode_hash',
  PASSCODE_SALT: 'auth_passcode_salt',
  PASSCODE_SET: 'auth_passcode_set',
  BIOMETRIC_ENABLED: 'auth_biometric_enabled',
  LOCK_TIMEOUT: 'auth_lock_timeout',
} as const;

async function hashPasscode(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pin);
}

function generateSalt(): string {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function savePasscode(pin: string): Promise<void> {
  const salt = generateSalt();
  const hash = await hashPasscode(pin, salt);
  await SecureStore.setItemAsync(KEYS.PASSCODE_HASH, hash);
  await SecureStore.setItemAsync(KEYS.PASSCODE_SALT, salt);
  Storage.setItemSync(KEYS.PASSCODE_SET, 'true');
}

export async function verifyPasscode(pin: string): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(KEYS.PASSCODE_SALT);
  const storedHash = await SecureStore.getItemAsync(KEYS.PASSCODE_HASH);
  if (!salt || !storedHash) return false;
  const hash = await hashPasscode(pin, salt);
  return hash === storedHash;
}

export async function clearPasscode(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.PASSCODE_HASH);
  await SecureStore.deleteItemAsync(KEYS.PASSCODE_SALT);
  Storage.setItemSync(KEYS.PASSCODE_SET, 'false');
  Storage.setItemSync(KEYS.BIOMETRIC_ENABLED, 'false');
}

export function loadAuthConfig() {
  return {
    isPasscodeSet: Storage.getItemSync(KEYS.PASSCODE_SET) === 'true',
    isBiometricEnabled: Storage.getItemSync(KEYS.BIOMETRIC_ENABLED) === 'true',
    lockTimeoutSeconds: parseInt(Storage.getItemSync(KEYS.LOCK_TIMEOUT) ?? '0', 10),
  };
}

export function saveBiometricEnabled(enabled: boolean): void {
  Storage.setItemSync(KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
}

export function saveLockTimeout(seconds: number): void {
  Storage.setItemSync(KEYS.LOCK_TIMEOUT, seconds.toString());
}
