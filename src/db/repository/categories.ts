import { eq, sql } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { categories, transactions, categorizationRules, budgets, transactionSplits } from '../schema';

type Database = any;

export async function createCategory(db: Database, data: {
  name: string;
  icon?: string;
  color?: string;
  type: 'expense' | 'income';
  parentId?: string;
}): Promise<string> {
  const id = uuid();
  await db.insert(categories).values({
    id,
    name: data.name.trim(),
    icon: data.icon,
    color: data.color,
    type: data.type,
    parentId: data.parentId,
    isDefault: false,
  });
  return id;
}

/** Cashew-style subcategory: one level under a main category, inheriting its
 * type; no own color (charts shade the parent's). */
export async function createSubcategory(db: Database, parentId: string, data: {
  name: string;
  icon?: string;
}): Promise<string> {
  const [parent] = await db.select().from(categories).where(eq(categories.id, parentId));
  if (!parent) throw new Error('Parent category not found');
  if (parent.parentId) throw new Error('Subcategories cannot have their own subcategories');
  return createCategory(db, { name: data.name, icon: data.icon, type: parent.type, parentId });
}

export async function updateCategory(db: Database, id: string, data: {
  name?: string;
  icon?: string;
  color?: string;
  type?: 'expense' | 'income';
}) {
  await db.update(categories).set(data).where(eq(categories.id, id));
  // A main category's type change carries through to its subcategories
  if (data.type) {
    await db.update(categories).set({ type: data.type }).where(eq(categories.parentId, id));
  }
}

/** How many transactions / rules / budgets reference this category. */
export async function getCategoryUsage(db: Database, id: string) {
  const [t] = await db.all(sql`SELECT COUNT(*) AS n FROM transactions WHERE category_id = ${id}`);
  const [r] = await db.all(sql`SELECT COUNT(*) AS n FROM categorization_rules WHERE category_id = ${id}`);
  const [b] = await db.all(sql`SELECT COUNT(*) AS n FROM budgets WHERE category_id = ${id}`);
  return { transactions: (t as any).n, rules: (r as any).n, budgets: (b as any).n };
}

/**
 * Delete a category (and, for a main category, its subcategories with it).
 * Referencing transactions become uncategorized; keyword rules and budgets
 * are removed.
 */
export async function deleteCategory(db: Database, id: string) {
  const children = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id));
  for (const target of [...children.map((c: any) => c.id), id]) {
    await db.update(transactions).set({ categoryId: null }).where(eq(transactions.categoryId, target));
    await db.update(transactionSplits).set({ categoryId: null }).where(eq(transactionSplits.categoryId, target));
    await db.delete(categorizationRules).where(eq(categorizationRules.categoryId, target));
    await db.delete(budgets).where(eq(budgets.categoryId, target));
    await db.delete(categories).where(eq(categories.id, target));
  }
}
