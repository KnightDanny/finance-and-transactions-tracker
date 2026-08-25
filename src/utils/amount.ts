/**
 * Regex that matches ETB amounts with or without decimals:
 * "ETB 8,000.00", "ETB1,500.00", "ETB 0.30", "ETB6000", "ETB 1360", "ETB10", "ETB 1360."
 */
const ETB_AMOUNT_REGEX = /ETB\s?[\d,]+(?:\.\d{0,2})?/gi;

function parseEtbMatch(match: string): number {
  const numStr = match.replace(/ETB\s?/i, '').replace(/,/g, '').replace(/\.$/, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract all ETB amounts from a text string.
 * Matches patterns like "ETB 8,000.00", "ETB1,500.00", "ETB 0.30", "ETB6000", "ETB10"
 * Returns array of parsed numbers.
 */
export function extractAllEtbAmounts(text: string): number[] {
  const matches = text.match(ETB_AMOUNT_REGEX);
  if (!matches) return [];

  return matches.map(parseEtbMatch).filter((n) => n > 0);
}

/**
 * Extract the amount that follows a specific keyword.
 * e.g., extractAmountAfterKeyword(text, "service charge") -> 10.00
 *
 * Only searches within a bounded window after the keyword so a far-away
 * amount (e.g. the total or the balance) is never mistaken for this fee.
 * Prefers an amount attached to "of" — handles both "of ETB 10.00" and the
 * bare "of 0.50" form (newer CBE SMS omit the ETB prefix on some fees).
 */
export function extractAmountAfterKeyword(
  text: string,
  keyword: string,
  windowChars: number = 60
): number | null {
  const lowerText = text.toLowerCase();
  const keywordIdx = lowerText.indexOf(keyword.toLowerCase());
  if (keywordIdx === -1) return null;

  const start = keywordIdx + keyword.length;
  const window = text.substring(start, start + windowChars);

  const ofMatch = window.match(/\bof\s+(?:ETB\s?)?([\d,]+(?:\.\d{1,2})?)/i);
  // Non-global copy: match() on a /g regex returns no .index for the comparison below
  const etbMatch = window.match(/ETB\s?[\d,]+(?:\.\d{0,2})?/i);

  let numStr: string | null = null;
  if (ofMatch && etbMatch) {
    // Both present — take whichever appears first in the window
    numStr = (ofMatch.index ?? 0) <= (etbMatch.index ?? 0) ? ofMatch[1] : etbMatch[0];
  } else if (ofMatch) {
    numStr = ofMatch[1];
  } else if (etbMatch) {
    numStr = etbMatch[0];
  }
  if (!numStr) return null;

  const num = parseEtbMatch(numStr);
  return num > 0 ? num : null;
}

/**
 * Extract the balance from SMS text.
 * Looks for "current balance is ETB X,XXX.XX" or "Current Balance is ETB X" patterns.
 * Also handles "current E-Money Account balance is ETB X", "current Saving balance is ETB X",
 * "current telebirr balance is ETB X", "current telebirr Account balance is ETB X",
 * and phrasings without "current" — e.g. "Your telebirr account balance is ETB X"
 * (TeleBirr bill payments). Requires "balance is ETB" so wallet balances quoted in
 * "Br." (CBE Birr) never match.
 */
export function extractBalance(text: string): number | null {
  // Match various balance patterns — "current" optional, up to a few words before "balance"
  const balanceMatch = text.match(
    /(?:current\s+)?(?:[\w-]+\s+){0,4}balance\s+is\s+ETB\s?[\d,]+(?:\.\d{0,2})?/i
  );
  if (!balanceMatch) return null;

  const amountMatch = balanceMatch[0].match(ETB_AMOUNT_REGEX);
  if (!amountMatch) return null;

  const num = parseEtbMatch(amountMatch[0]);
  return num >= 0 ? num : null;
}
