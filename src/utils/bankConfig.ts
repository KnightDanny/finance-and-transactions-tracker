import { ImageSourcePropType } from 'react-native';

export interface BankConfig {
  name: string;
  color: string;
  textColor: string;
  logo: ImageSourcePropType;
  /** When set, cards render this emoji instead of the logo image. */
  emoji?: string;
}

// Muted bank identities tuned to the ink-and-gold palette — used as accent
// spines/dots rather than full-bleed card fills.
const bankConfigs: Record<string, BankConfig> = {
  CBE: {
    name: 'CBE',
    color: '#8D6CAB',
    textColor: '#fff',
    logo: require('@/assets/images/banks/cbe.webp'),
  },
  TELEBIRR: {
    name: 'TeleBirr',
    color: '#5E9BC9',
    textColor: '#fff',
    logo: require('@/assets/images/banks/telebirr.webp'),
  },
  BOA: {
    name: 'BOA',
    color: '#A6803A',
    textColor: '#fff',
    logo: require('@/assets/images/banks/boa.png'),
  },
  AWASH: {
    name: 'Awash',
    color: '#C4643C',
    textColor: '#fff',
    logo: require('@/assets/images/banks/awash.png'),
  },
  // User-maintained accounts (USD/USDT/USDC wallets, cash) — no SMS feed
  MANUAL: {
    name: 'Wallet',
    color: '#D4B96A',
    textColor: '#0C0B09',
    logo: require('@/assets/images/banks/cbe.webp'), // unused — emoji renders instead
    emoji: '🪙',
  },
};

// Email-fed wallet providers. Their accounts are all bank 'MANUAL', so they
// are told apart by the account label ("BINANCE USDT", "Morse USD", ...).
const providerConfigs: Record<string, BankConfig> = {
  BINANCE: {
    name: 'Binance',
    color: '#E0B33B',
    textColor: '#0C0B09',
    logo: require('@/assets/images/banks/binance.png'),
  },
  BYBIT: {
    name: 'Bybit',
    color: '#4A4656',
    textColor: '#fff',
    logo: require('@/assets/images/banks/bybit.png'),
  },
  MORSE: {
    name: 'Morse',
    color: '#E0603C',
    textColor: '#fff',
    logo: require('@/assets/images/banks/morse.png'),
  },
  OKX: {
    name: 'OKX',
    color: '#5C5C66',
    textColor: '#fff',
    logo: require('@/assets/images/banks/okx.png'),
  },
};

const defaultConfig: BankConfig = {
  name: 'Unknown',
  color: '#98917F',
  textColor: '#fff',
  logo: require('@/assets/images/banks/cbe.webp'), // fallback
};

export function getBankConfig(bank?: string, label?: string): BankConfig {
  if (!bank) return defaultConfig;
  if (bank.toUpperCase() === 'MANUAL' && label) {
    const up = label.toUpperCase();
    for (const key of Object.keys(providerConfigs)) {
      if (up.includes(key)) return providerConfigs[key];
    }
  }
  return bankConfigs[bank.toUpperCase()] ?? defaultConfig;
}
