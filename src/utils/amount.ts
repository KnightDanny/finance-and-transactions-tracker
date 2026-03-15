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
 */
export function extractAmountAfterKeyword(text: string, keyword: string): number | null {
  const lowerText = text.toLowerCase();
  const keywordIdx = lowerText.indexOf(keyword.toLowerCase());
  if (keywordIdx === -1) return null;

  // Search for ETB amount after the keyword
  const afterKeyword = text.substring(keywordIdx + keyword.length);
  const match = afterKeyword.match(ETB_AMOUNT_REGEX);
  if (!match) return null;

  const num = parseEtbMatch(match[0]);
  return num > 0 ? num : null;
}

/**
 * Extract the balance from SMS text.
 * Looks for "current balance is ETB X,XXX.XX" or "Current Balance is ETB X" patterns.
 * Also handles "current E-Money Account balance is ETB X", "current Saving balance is ETB X",
 * and "current telebirr balance is ETB X", "current telebirr Account balance is ETB X".
 */
export function extractBalance(text: string): number | null {
  // Match various balance patterns — allow optional words between "current" and "balance"
  const balanceMatch = text.match(
    /current\s+(?:[\w-]+\s+){0,4}balance\s+is\s+ETB\s?[\d,]+(?:\.\d{0,2})?/i
  );
  if (!balanceMatch) return null;

  const amountMatch = balanceMatch[0].match(ETB_AMOUNT_REGEX);
  if (!amountMatch) return null;

  const num = parseEtbMatch(amountMatch[0]);
  return num >= 0 ? num : null;
}
