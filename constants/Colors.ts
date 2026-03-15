// Cashew-inspired Material 3 color system
const accent = '#1B447A';

export const theme = {
  accent,
  income: '#59A849',
  expense: '#CA5A5A',
  incomeDark: '#62CA77',
  expenseDark: '#DA7272',
  warning: '#CA995A',
  unpaidUpcoming: '#58A4C2',
  unpaidOverdue: '#6577E0',
  star: '#FFD723',
};

export default {
  light: {
    text: '#000',
    textSecondary: '#888888',
    background: '#F7F7F7',
    surface: '#FFFFFF',
    surfaceVariant: '#EBEBEB',
    tint: accent,
    accent,
    tabIconDefault: '#999',
    tabIconSelected: accent,
    divider: '#F0F0F0',
    shadow: 'rgba(90, 90, 90, 0.18)',
    income: theme.income,
    expense: theme.expense,
    cardBorder: 'transparent',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#666666',
    background: '#0F0F0F',
    surface: '#1A1A1A',
    surfaceVariant: '#242424',
    tint: '#7BAFDB',
    accent: '#7BAFDB',
    tabIconDefault: '#555',
    tabIconSelected: '#7BAFDB',
    divider: 'rgba(255, 255, 255, 0.075)',
    shadow: 'rgba(0, 0, 0, 0.4)',
    income: theme.incomeDark,
    expense: theme.expenseDark,
    cardBorder: 'rgba(255,255,255,0.06)',
  },
};
