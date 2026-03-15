import { ImageSourcePropType } from 'react-native';

export interface BankConfig {
  name: string;
  color: string;
  textColor: string;
  logo: ImageSourcePropType;
}

const bankConfigs: Record<string, BankConfig> = {
  CBE: {
    name: 'CBE',
    color: '#4e1b56',
    textColor: '#fff',
    logo: require('@/assets/images/banks/cbe.webp'),
  },
  TELEBIRR: {
    name: 'TeleBirr',
    color: '#056ab8',
    textColor: '#fff',
    logo: require('@/assets/images/banks/telebirr.webp'),
  },
};

const defaultConfig: BankConfig = {
  name: 'Unknown',
  color: '#666',
  textColor: '#fff',
  logo: require('@/assets/images/banks/cbe.webp'), // fallback
};

export function getBankConfig(bank?: string): BankConfig {
  if (!bank) return defaultConfig;
  return bankConfigs[bank.toUpperCase()] ?? defaultConfig;
}
