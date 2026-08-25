import { desc } from 'drizzle-orm';
import { categorizationRules } from '@/src/db/schema';

/**
 * Auto-categorize a transaction based on counterparty name and SMS content.
 * Checks ONLY user-defined categorization rules (keyword → category) — there
 * are deliberately no built-in fallback heuristics: transactions stay
 * uncategorized until the user creates rules (or assigns manually), so the
 * category breakdown never shows guesses as facts.
 * Returns the category ID or null if no rule matches.
 */
export async function autoCategorize(
  db: any,
  counterparty?: string,
  rawSms?: string
): Promise<string | null> {
  // Get all rules sorted by priority (highest first)
  const rules = await db
    .select()
    .from(categorizationRules)
    .orderBy(desc(categorizationRules.priority));

  const searchText = [counterparty, rawSms].filter(Boolean).join(' ').toLowerCase();

  for (const rule of rules) {
    if (searchText.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId;
    }
  }

  return null;
}

/**
 * Add a categorization rule (for learning from user corrections).
 */
export async function addCategorizationRule(
  db: any,
  keyword: string,
  categoryId: string,
  priority: number = 10
) {
  const { generateId: uuid } = require('../utils/id');
  await db.insert(categorizationRules).values({
    id: uuid(),
    keyword,
    categoryId,
    priority,
  });
}
