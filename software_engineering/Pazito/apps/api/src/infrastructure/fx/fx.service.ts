import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../database/client.js';
import { fxRateCache } from '../database/schema.js';
import { unprocessable } from '../../shared/errors/app-error.js';

export type FxQuote = { rate: string; source: string; asOf: Date };
const FX_SCALE = 1_000_000_000_000n;
/** Normalize every provider/manual rate to the exact 12-decimal precision persisted in DECIMAL(24,12). */
function normalizeRate(raw: string): string {
  if (!/^\d{1,12}(?:\.\d{1,30})?$/.test(raw)) throw new Error('Invalid FX rate format');
  const [whole, fraction = ''] = raw.split('.');
  let scaled = BigInt(whole!) * FX_SCALE + BigInt((fraction.slice(0, 12) || '0').padEnd(12, '0'));
  if (fraction.length > 12 && fraction[12]! >= '5') scaled += 1n;
  if (scaled <= 0n || scaled >= 10n ** 24n) throw new Error('FX rate outside DECIMAL(24,12) range');
  const wholePart = (scaled / FX_SCALE).toString();
  const fractionalPart = (scaled % FX_SCALE).toString().padStart(12, '0').replace(/0+$/, '');
  return fractionalPart ? `${wholePart}.${fractionalPart}` : wholePart;
}
const reciprocal = (rate: string): string => {
  const [whole, fraction = ''] = rate.split('.');
  const denominator = BigInt(whole + fraction);
  if (denominator <= 0n) throw new Error('Invalid FX rate');
  const numerator = 10n ** BigInt(fraction.length + 12);
  const value = numerator / denominator;
  const digits = value.toString().padStart(13, '0');
  const decimal = `${digits.slice(0, -12)}.${digits.slice(-12)}`;
  return decimal.replace(/0+$/, '').replace(/\.$/, '');
};

export async function getFxQuote(baseCurrency: string, quoteCurrency: string, manualRate?: string): Promise<FxQuote> {
  if (baseCurrency === quoteCurrency) return { rate: '1', source: 'same-currency', asOf: new Date() };
  if (manualRate) return { rate: normalizeRate(manualRate), source: 'user-entered', asOf: new Date() };

  const now = new Date();
  const cached = await db.select().from(fxRateCache).where(and(eq(fxRateCache.baseCurrency, baseCurrency), eq(fxRateCache.quoteCurrency, quoteCurrency), gt(fxRateCache.expiresAt, now))).limit(1);
  if (cached[0]) return { rate: cached[0].rate, source: cached[0].source, asOf: cached[0].asOf };

  if (env.FX_PROVIDER !== 'frankfurter') throw unprocessable(`No hay una tasa de cambio disponible para ${baseCurrency}/${quoteCurrency}; proporciona una tasa aprobada o usa la misma moneda del grupo`, 'FX_RATE_UNAVAILABLE');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), env.FX_TIMEOUT_MS);
  try {
    const url = new URL(`${env.FX_API_BASE_URL.replace(/\/$/, '')}/latest`);
    url.searchParams.set('from', baseCurrency); url.searchParams.set('to', quoteCurrency);
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Proveedor FX respondió ${response.status}`);
    const data = await response.json() as { date?: string; rates?: Record<string, number | string> };
    const rawRate = data.rates?.[quoteCurrency];
    if (rawRate === undefined) throw new Error('El proveedor no devolvió la moneda solicitada');
    const rate = normalizeRate(String(rawRate));
    const asOf = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? new Date(`${data.date}T12:00:00.000Z`) : new Date();
    await cacheQuote(baseCurrency, quoteCurrency, rate, 'frankfurter', asOf);
    return { rate, source: 'frankfurter', asOf };
  } catch {
    // No silently use a stale rate beyond expiry when no current provider quote is available.
    const inverse = await db.select().from(fxRateCache).where(and(eq(fxRateCache.baseCurrency, quoteCurrency), eq(fxRateCache.quoteCurrency, baseCurrency), gt(fxRateCache.expiresAt, now))).limit(1);
    if (inverse[0]) return { rate: reciprocal(inverse[0].rate), source: `${inverse[0].source}-inverted-cache`, asOf: inverse[0].asOf };
    throw unprocessable(`No se pudo obtener una tasa de cambio vigente para ${baseCurrency}/${quoteCurrency}. Comprueba la conexión o introduce una tasa manual`, 'FX_RATE_UNAVAILABLE');
  } finally { clearTimeout(timeout); }
}
async function cacheQuote(base: string, quote: string, rate: string, source: string, asOf: Date) {
  const expiresAt = new Date(Date.now() + env.FX_CACHE_HOURS * 3_600_000);
  const existing = await db.select({ id: fxRateCache.id }).from(fxRateCache).where(and(eq(fxRateCache.baseCurrency, base), eq(fxRateCache.quoteCurrency, quote))).limit(1);
  if (existing[0]) {
    await db.update(fxRateCache).set({ rate, source, asOf, expiresAt }).where(eq(fxRateCache.id, existing[0].id));
  } else {
    await db.insert(fxRateCache).values({ id: randomUUID(), baseCurrency: base, quoteCurrency: quote, rate, source, asOf, expiresAt });
  }
}
