import { ImageSourcePropType } from 'react-native';

export interface BankConfig {
  name: string;
  color: string;
  textColor: string;
  logo: ImageSourcePropType;
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
};

const defaultConfig: BankConfig = {
  name: 'Unknown',
  color: '#98917F',
  textColor: '#fff',
  logo: require('@/assets/images/banks/cbe.webp'), // fallback
};

export function getBankConfig(bank?: string): BankConfig {
  if (!bank) return defaultConfig;
  return bankConfigs[bank.toUpperCase()] ?? defaultConfig;
}
