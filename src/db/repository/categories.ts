import { eq, sql } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { categories, transactions, categorizationRules, budgets } from '../schema';

type Database = any;

export async function createCategory(db: Database, data: {
  name: string;
  icon?: string;
  color?: string;
  type: 'expense' | 'income';
}): Promise<string> {
  const id = uuid();
  await db.insert(categories).values({
    id,
    name: data.name.trim(),
    icon: data.icon,
    color: data.color,
    type: data.type,
    isDefault: false,
  });
  return id;
}

export async function updateCategory(db: Database, id: string, data: {
  name?: string;
  icon?: string;
  color?: string;
  type?: 'expense' | 'income';
}) {
  await db.update(categories).set(data).where(eq(categories.id, id));
}

/** How many transactions / rules / budgets reference this category. */
export async function getCategoryUsage(db: Database, id: string) {
  const [t] = await db.all(sql`SELECT COUNT(*) AS n FROM transactions WHERE category_id = ${id}`);
  const [r] = await db.all(sql`SELECT COUNT(*) AS n FROM categorization_rules WHERE category_id = ${id}`);
  const [b] = await db.all(sql`SELECT COUNT(*) AS n FROM budgets WHERE category_id = ${id}`);
  return { transactions: (t as any).n, rules: (r as any).n, budgets: (b as any).n };
}

/**
 * Delete a category. Referencing transactions become uncategorized; its
 * keyword rules and budgets are removed with it.
 */
export async function deleteCategory(db: Database, id: string) {
  await db.update(transactions).set({ categoryId: null }).where(eq(transactions.categoryId, id));
  await db.delete(categorizationRules).where(eq(categorizationRules.categoryId, id));
  await db.delete(budgets).where(eq(budgets.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));
}
