import { eq, desc } from 'drizzle-orm';
import { categorizationRules, categories } from '@/src/db/schema';

/**
 * Auto-categorize a transaction based on counterparty name and SMS content.
 * Checks user-defined categorization rules (keyword → category).
 * Returns the category ID or null if no match.
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

  // Fallback: try to match against built-in heuristics
  return fallbackCategorize(db, counterparty, rawSms);
}

/**
 * Built-in fallback categorization when no user rules match.
 * Uses simple keyword heuristics.
 */
async function fallbackCategorize(
  db: any,
  counterparty?: string,
  rawSms?: string
): Promise<string | null> {
  const text = [counterparty, rawSms].filter(Boolean).join(' ').toLowerCase();

  // Map of keywords to category names
  const heuristics: [string[], string][] = [
    [['commercial bank', 'cbe', 'bank transfer', 'telebirr'], 'Transfer Out'],
    [['salary', 'wage', 'payroll'], 'Salary'],
    [['uber', 'ride', 'taxi', 'bolt'], 'Transport'],
    [['restaurant', 'cafe', 'food', 'pizza', 'burger'], 'Food & Dining'],
    [['pharmacy', 'hospital', 'clinic', 'medical'], 'Health'],
    [['school', 'university', 'tuition', 'course'], 'Education'],
    [['electric', 'water', 'internet', 'phone bill'], 'Utilities'],
    [['rent', 'landlord'], 'Rent & Housing'],
  ];

  for (const [keywords, categoryName] of heuristics) {
    if (keywords.some((kw) => text.includes(kw))) {
      const cats = await db
        .select()
        .from(categories)
        .where(eq(categories.name, categoryName));
      if (cats.length > 0) return cats[0].id;
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
