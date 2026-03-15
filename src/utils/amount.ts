/**
 * Extract all ETB amounts from a text string.
 * Matches patterns like "ETB 8,000.00", "ETB1,500.00", "ETB 0.30"
 * Returns array of parsed numbers.
 */
export function extractAllEtbAmounts(text: string): number[] {
  const regex = /ETB\s?[\d,]+\.\d{2}/gi;
  const matches = text.match(regex);
  if (!matches) return [];

  return matches.map((m) => {
    const numStr = m.replace(/ETB\s?/i, '').replace(/,/g, '');
    return parseFloat(numStr);
  }).filter((n) => !isNaN(n));
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
  const match = afterKeyword.match(/ETB\s?[\d,]+\.\d{2}/i);
  if (!match) return null;

  const numStr = match[0].replace(/ETB\s?/i, '').replace(/,/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}

/**
 * Extract the balance from SMS text.
 * Looks for "current balance is ETB X,XXX.XX" patterns (case-insensitive).
 */
export function extractBalance(text: string): number | null {
  // Match various balance patterns
  const balanceMatch = text.match(/current\s+(?:e-money\s+account\s+)?balance\s+is\s+ETB\s?[\d,]+\.\d{2}/i);
  if (!balanceMatch) return null;

  const amountMatch = balanceMatch[0].match(/ETB\s?[\d,]+\.\d{2}/i);
  if (!amountMatch) return null;

  const numStr = amountMatch[0].replace(/ETB\s?/i, '').replace(/,/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}
