import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { budgets, transactions, categories } from '@/src/db/schema';

interface BudgetProgress {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  limitAmount: number;
  spentAmount: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

/**
 * Get budget progress for a given month.
 * Returns each budget category with spent amount and remaining.
 */
export async function getBudgetProgress(db: any, month: string): Promise<BudgetProgress[]> {
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  // Get all budgets for the month with category info
  const monthBudgets = await db
    .select({
      budgetId: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      limitAmount: budgets.limitAmount,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.month, month));

  // Get spending by category for the month
  const spending = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'debit'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(transactions.categoryId);

  const spendingMap: Record<string, number> = {};
  for (const s of spending) {
    if (s.categoryId) spendingMap[s.categoryId] = s.total;
  }

  return monthBudgets.map((b: any) => {
    const spent = spendingMap[b.categoryId] ?? 0;
    const remaining = b.limitAmount - spent;
    return {
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      categoryIcon: b.categoryIcon,
      limitAmount: b.limitAmount,
      spentAmount: spent,
      remaining,
      percentage: b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0,
      isOverBudget: spent > b.limitAmount,
    };
  });
}
