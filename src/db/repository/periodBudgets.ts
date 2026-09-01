import { eq } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { periodBudgets, categories } from '../schema';
import { getSpendingByCategory } from './transactions';

type Database = any;

export interface PeriodBudget {
  id: string;
  name: string | null;
  limitAmount: number;
  period: 'month' | 'custom';
  startDate: string | null;
  endDate: string | null;
  /** Included MAIN category ids; null = all spending. */
  categoryIds: string[] | null;
  /** Per-category caps within this budget: {mainCategoryId: limit}. */
  categoryLimits: Record<string, number> | null;
  showOnHome: boolean;
}

function rowToBudget(r: any): PeriodBudget {
  let categoryIds: string[] | null = null;
  let categoryLimits: Record<string, number> | null = null;
  try {
    const parsed = r.categoriesJson ? JSON.parse(r.categoriesJson) : null;
    if (Array.isArray(parsed)) categoryIds = parsed;
  } catch {}
  try {
    const parsed = r.categoryLimitsJson ? JSON.parse(r.categoryLimitsJson) : null;
    if (parsed && typeof parsed === 'object') categoryLimits = parsed;
  } catch {}
  return {
    id: r.id,
    name: r.name,
    limitAmount: r.limitAmount,
    period: r.period === 'custom' ? 'custom' : 'month',
    startDate: r.startDate,
    endDate: r.endDate,
    categoryIds,
    categoryLimits,
    showOnHome: r.showOnHome == null ? true : !!r.showOnHome,
  };
}

export async function getPeriodBudgets(db: Database): Promise<PeriodBudget[]> {
  const rows = await db.select().from(periodBudgets);
  return rows.map(rowToBudget);
}

export async function savePeriodBudget(db: Database, data: {
  id?: string;
  name?: string;
  limitAmount: number;
  period: 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  categoryIds: string[] | null;
  categoryLimits?: Record<string, number> | null;
  showOnHome?: boolean;
}): Promise<string> {
  const limits = data.categoryLimits && Object.keys(data.categoryLimits).length > 0 ? data.categoryLimits : null;
  const values = {
    name: data.name?.trim() || null,
    limitAmount: data.limitAmount,
    period: data.period,
    startDate: data.period === 'custom' ? data.startDate ?? null : null,
    endDate: data.period === 'custom' ? data.endDate ?? null : null,
    categoriesJson: data.categoryIds ? JSON.stringify(data.categoryIds) : null,
    categoryLimitsJson: limits ? JSON.stringify(limits) : null,
    showOnHome: data.showOnHome !== false,
  };
  if (data.id) {
    await db.update(periodBudgets).set(values).where(eq(periodBudgets.id, data.id));
    return data.id;
  }
  const id = uuid();
  await db.insert(periodBudgets).values({ id, ...values, createdAt: new Date().toISOString() });
  return id;
}

export async function deletePeriodBudget(db: Database, id: string) {
  await db.delete(periodBudgets).where(eq(periodBudgets.id, id));
}

export interface BudgetWithSpend extends PeriodBudget {
  spent: number;
  rangeStart: string;
  rangeEnd: string;
  /** Spend within the budget's range keyed by category id — subcategories
   * under their own id AND rolled into their parent's. */
  perCategorySpend: Record<string, number>;
  /** Distinct main-category families included; null = all spending. */
  familyCount: number | null;
  /** Days left in the period including today; null when today is outside it. */
  daysLeft: number | null;
  /** Untouched budget ÷ days left — "you can spend X/day"; null with daysLeft. */
  perDayLeft: number | null;
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Every budget with its spending: 'month' budgets track viewMonth
 * ('YYYY-MM'); 'custom' budgets track their own range regardless. Spending
 * rows (which include split re-attribution, fees, and subcategory buckets)
 * roll up to MAIN categories before the include-filter applies, so budgeting
 * "Food" counts its subcategories too. A null filter counts everything —
 * uncategorized and fees included.
 */
export async function getPeriodBudgetsWithSpend(db: Database, viewMonth: string): Promise<BudgetWithSpend[]> {
  const budgets = await getPeriodBudgets(db);
  if (budgets.length === 0) return [];
  const cats = await db.select().from(categories);
  const parentOf = new Map(cats.map((c: any) => [c.id, c.parentId ?? c.id]));

  const cache = new Map<string, any[]>();
  const spendRows = async (start: string, end: string) => {
    const key = `${start}|${end}`;
    if (!cache.has(key)) cache.set(key, await getSpendingByCategory(db, start, end));
    return cache.get(key)!;
  };

  const [y, m] = viewMonth.split('-').map(Number);
  const monthEnd = isoDay(new Date(y, m, 0)); // last actual day of the month
  const todayIso = isoDay(new Date());

  const out: BudgetWithSpend[] = [];
  for (const b of budgets) {
    const range = b.period === 'custom'
      ? { start: b.startDate || '0000-01-01', end: b.endDate || '9999-12-31' }
      : { start: `${viewMonth}-01`, end: monthEnd };
    const rows = await spendRows(range.start, range.end);
    const included = b.categoryIds ? new Set(b.categoryIds) : null;
    // New-style sets list every included leaf (subcategories individually);
    // legacy sets held only main ids and mean "the whole family"
    const leafSemantics = b.categoryIds?.some((id) => {
      const p = parentOf.get(id);
      return p != null && p !== id;
    }) ?? false;
    let spent = 0;
    const perCategorySpend: Record<string, number> = {};
    for (const row of rows) {
      const leafId = row.categoryId ?? null;
      const mainId = leafId ? parentOf.get(leafId) ?? leafId : null;
      if (included) {
        if (!leafId) continue;
        const hit = leafSemantics ? included.has(leafId) : mainId != null && included.has(mainId);
        if (!hit) continue;
      }
      spent += row.total;
      if (leafId) perCategorySpend[leafId] = (perCategorySpend[leafId] ?? 0) + row.total;
      if (mainId && mainId !== leafId) perCategorySpend[mainId] = (perCategorySpend[mainId] ?? 0) + row.total;
    }
    const familyCount = b.categoryIds
      ? new Set(b.categoryIds.map((id) => parentOf.get(id) ?? id)).size
      : null;

    // "You can still spend X per day" — only while today is inside the period
    let daysLeft: number | null = null;
    let perDayLeft: number | null = null;
    if (todayIso >= range.start && todayIso <= range.end && range.end < '9999') {
      const end = new Date(`${range.end}T00:00:00`).getTime();
      const today = new Date(`${todayIso}T00:00:00`).getTime();
      daysLeft = Math.max(1, Math.round((end - today) / 86400000) + 1);
      perDayLeft = Math.max(0, b.limitAmount - spent) / daysLeft;
    }

    out.push({ ...b, spent, rangeStart: range.start, rangeEnd: range.end, perCategorySpend, familyCount, daysLeft, perDayLeft });
  }
  return out;
}
