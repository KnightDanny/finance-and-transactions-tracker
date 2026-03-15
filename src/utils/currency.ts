export function formatCurrency(amount: number): string {
  return `ETB ${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parse an ETB amount string like "ETB 8,000.00" or "ETB1,500.00" to a number.
 * Returns null if parsing fails.
 */
export function parseEtbAmount(text: string): number | null {
  // Remove "ETB" prefix and whitespace, then remove commas
  const cleaned = text.replace(/ETB\s*/i, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
