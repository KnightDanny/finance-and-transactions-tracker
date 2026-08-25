// Typography for the "private ledger" design system.
// Plus Jakarta Sans carries headings + UI text; DM Mono carries every amount.
// On Android, custom fonts do NOT synthesize weights — always use the exact
// weight-specific family name, never fontWeight with these.

export const fonts = {
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtraBold: 'PlusJakartaSans_800ExtraBold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

/** Spaced small-caps section label (e.g. "ACCOUNTS", "BY CATEGORY"). */
export const sectionLabel = {
  fontFamily: fonts.sansBold,
  fontSize: 10.5,
  letterSpacing: 1.7,
  textTransform: 'uppercase' as const,
};
