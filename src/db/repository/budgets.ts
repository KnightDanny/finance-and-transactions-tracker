import { eq, and } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { budgets, categories } from '../schema';

type Database = any;

export async function getBudgetsForMonth(db: Database, month: string) {
  return db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      month: budgets.month,
      limitAmount: budgets.limitAmount,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.month, month));
}

export async function upsertBudget(
  db: Database,
  data: { categoryId: string; month: string; limitAmount: number }
) {
  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.categoryId, data.categoryId), eq(budgets.month, data.month)));

  if (existing.length > 0) {
    await db
      .update(budgets)
      .set({ limitAmount: data.limitAmount })
      .where(eq(budgets.id, existing[0].id));
    return existing[0].id;
  }

  const id = uuid();
  await db.insert(budgets).values({
    id,
    categoryId: data.categoryId,
    month: data.month,
    limitAmount: data.limitAmount,
  });
  return id;
}

export async function deleteBudget(db: Database, id: string) {
  await db.delete(budgets).where(eq(budgets.id, id));
}

export async function getAllCategories(db: Database) {
  return db.select().from(categories);
}

export async function getExpenseCategories(db: Database) {
  return db.select().from(categories).where(eq(categories.type, 'expense'));
}

export async function getIncomeCategories(db: Database) {
  return db.select().from(categories).where(eq(categories.type, 'income'));
}
