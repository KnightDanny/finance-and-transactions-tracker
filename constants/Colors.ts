// "Private ledger" design system — warm ink surfaces, champagne-gold accent.
// Hairline borders instead of shadows; sage/terracotta for money directions.

const gold = '#D4B96A';
const goldLight = '#A8863B';

export const theme = {
  accent: gold,
  income: '#5E8C46',
  expense: '#B25E4A',
  incomeDark: '#8FB573',
  expenseDark: '#C97B67',
  warning: '#C99667',
  unpaidUpcoming: '#5E9BC9',
  unpaidOverdue: '#8D6CAB',
  star: '#D4B96A',
};

export default {
  light: {
    text: '#211D14',
    textSecondary: '#6E6654',
    textTertiary: '#9A937F',
    background: '#F6F3EB',
    surface: '#FFFDF8',
    surfaceVariant: '#EFEAE0',
    tint: goldLight,
    accent: goldLight,
    gold: goldLight,
    goldDim: 'rgba(168,134,59,0.10)',
    tabIconDefault: '#9A937F',
    tabIconSelected: goldLight,
    divider: 'rgba(92,78,44,0.12)',
    hairline: 'rgba(92,78,44,0.12)',
    hairlineStrong: 'rgba(92,78,44,0.26)',
    shadow: 'rgba(60,50,20,0.14)',
    income: theme.income,
    expense: theme.expense,
    warning: '#A8763B',
    cardBorder: 'rgba(92,78,44,0.12)',
  },
  dark: {
    text: '#F1EDE2',
    textSecondary: '#98917F',
    textTertiary: '#5E594C',
    background: '#0C0B09',
    surface: '#141310',
    surfaceVariant: '#1B1915',
    tint: gold,
    accent: gold,
    gold,
    goldDim: 'rgba(212,185,106,0.14)',
    tabIconDefault: '#5E594C',
    tabIconSelected: gold,
    divider: 'rgba(228,209,158,0.10)',
    hairline: 'rgba(228,209,158,0.10)',
    hairlineStrong: 'rgba(228,209,158,0.22)',
    shadow: 'rgba(0,0,0,0.4)',
    income: theme.incomeDark,
    expense: theme.expenseDark,
    warning: theme.warning,
    cardBorder: 'rgba(228,209,158,0.10)',
  },
};
