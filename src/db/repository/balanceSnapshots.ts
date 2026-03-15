import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { generateId as uuid } from '@/src/utils/id';
import { balanceSnapshots } from '../schema';

type Database = any;

export async function insertBalanceSnapshot(
  db: Database,
  data: { accountId: string; balance: number; recordedAt: string; source?: string }
) {
  const id = uuid();
  await db.insert(balanceSnapshots).values({
    id,
    accountId: data.accountId,
    balance: data.balance,
    recordedAt: data.recordedAt,
    source: data.source ?? 'sms',
  });
  return id;
}

export async function getSnapshotsForAccount(
  db: Database,
  accountId: string,
  startDate?: string,
  endDate?: string
) {
  const conditions = [eq(balanceSnapshots.accountId, accountId)];
  if (startDate) conditions.push(gte(balanceSnapshots.recordedAt, startDate));
  if (endDate) conditions.push(lte(balanceSnapshots.recordedAt, endDate));

  return db
    .select()
    .from(balanceSnapshots)
    .where(and(...conditions))
    .orderBy(balanceSnapshots.recordedAt);
}

export async function getAllSnapshots(db: Database, startDate?: string, endDate?: string) {
  const conditions = [];
  if (startDate) conditions.push(gte(balanceSnapshots.recordedAt, startDate));
  if (endDate) conditions.push(lte(balanceSnapshots.recordedAt, endDate));

  let query = db.select().from(balanceSnapshots);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(balanceSnapshots.recordedAt);
}
