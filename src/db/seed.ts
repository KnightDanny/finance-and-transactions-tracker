import { eq } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { categories } from './schema';

const DEFAULT_CATEGORIES = [
  // Expense categories
  { name: 'Food & Dining', icon: '🍽️', type: 'expense' as const },
  { name: 'Transport', icon: '🚕', type: 'expense' as const },
  { name: 'Rent & Housing', icon: '🏠', type: 'expense' as const },
  { name: 'Utilities', icon: '💡', type: 'expense' as const },
  { name: 'Shopping', icon: '🛒', type: 'expense' as const },
  { name: 'Entertainment', icon: '🎬', type: 'expense' as const },
  { name: 'Health', icon: '🏥', type: 'expense' as const },
  { name: 'Education', icon: '📚', type: 'expense' as const },
  { name: 'Transfer Out', icon: '↗️', type: 'expense' as const },
  { name: 'Withdrawal', icon: '🏧', type: 'expense' as const },
  { name: 'Other Expense', icon: '📎', type: 'expense' as const },
  // Income categories
  { name: 'Salary', icon: '💰', type: 'income' as const },
  { name: 'Transfer In', icon: '↙️', type: 'income' as const },
  { name: 'Other Income', icon: '💵', type: 'income' as const },
];

export async function seedDefaultCategories(db: any) {
  const existing = await db.select().from(categories);
  if (existing.length > 0) return;

  for (const cat of DEFAULT_CATEGORIES) {
    await db.insert(categories).values({
      id: uuid(),
      name: cat.name,
      icon: cat.icon,
      type: cat.type,
      isDefault: true,
    });
  }
}
