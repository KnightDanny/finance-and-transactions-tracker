import { eq } from 'drizzle-orm';
import { currencyRates } from '../schema';

type Database = any;

export interface CurrencyRate {
  currency: string;
  rateToEtb: number;
  updatedAt: string | null;
  source: 'manual' | 'auto';
}

/** Currencies offered when creating a manual account. Any code typed by the
 * user works too — these are just the quick picks. */
export const COMMON_CURRENCIES = ['ETB', 'USD', 'EUR', 'USDT', 'USDC'];

export async function getAllRates(db: Database): Promise<CurrencyRate[]> {
  return db.select().from(currencyRates);
}

/** currency → ETB multiplier map. ETB is always 1. A currency with no saved
 * rate is absent — callers decide how to surface that. */
export async function getRateMap(db: Database): Promise<Record<string, number>> {
  const rows = await getAllRates(db);
  const map: Record<string, number> = { ETB: 1 };
  for (const r of rows) map[r.currency] = r.rateToEtb;
  return map;
}

export async function setRate(
  db: Database,
  currency: string,
  rateToEtb: number,
  source: 'manual' | 'auto' = 'manual'
): Promise<void> {
  const code = currency.toUpperCase();
  const existing = await db.select().from(currencyRates).where(eq(currencyRates.currency, code));
  const values = { rateToEtb, updatedAt: new Date().toISOString(), source };
  if (existing.length > 0) {
    await db.update(currencyRates).set(values).where(eq(currencyRates.currency, code));
  } else {
    await db.insert(currencyRates).values({ currency: code, ...values });
  }
}

/**
 * Fetch current X→ETB rates from the free, keyless currency-api dataset
 * (github.com/fawazahmed0/exchange-api, served via jsDelivr). The dataset is
 * ETB-based (1 ETB = x units of X), so rates are inverted. Covers fiat and
 * crypto including USDT/USDC. Throws on network failure — callers surface it.
 *
 * Note: this is the official/market rate. If you track the parallel rate,
 * edit the rate manually instead — manual edits are never auto-overwritten
 * until you fetch again.
 */
export async function fetchRatesToEtb(currencies: string[]): Promise<Record<string, number>> {
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/etb.min.json'
  );
  if (!res.ok) throw new Error(`Rate service returned ${res.status}`);
  const data = await res.json();
  const etbTo: Record<string, number> = data?.etb ?? {};
  const out: Record<string, number> = {};
  for (const c of currencies) {
    const perEtb = etbTo[c.toLowerCase()];
    if (typeof perEtb === 'number' && perEtb > 0) {
      out[c.toUpperCase()] = 1 / perEtb;
    }
  }
  return out;
}
