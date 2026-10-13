import { badRequest } from '../errors/app-error.js';

const supportedCurrencies = new Set(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : []);

export function currencyExponent(currency: string): number {
  try {
    if (!/^[A-Z]{3}$/.test(currency) || (supportedCurrencies.size > 0 && !supportedCurrencies.has(currency))) throw new Error('Unsupported currency');
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    throw badRequest(`Código de moneda no soportado: ${currency}`, 'INVALID_CURRENCY');
  }
}
export function isValidCurrency(currency: string): boolean {
  try { currencyExponent(currency); return true; } catch { return false; }
}
export function toSafeAmount(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Importe excede el rango seguro del contrato JSON; se requiere migrar amountMinor a string.');
  return n;
}
export function assertPositiveSafeMinor(value: number, label = 'importe'): bigint {
  if (!Number.isSafeInteger(value) || value <= 0) throw badRequest(`${label} debe ser un entero positivo seguro`, 'INVALID_AMOUNT');
  return BigInt(value);
}
export function assertNonNegativeSafeMinor(value: number, label = 'importe'): bigint {
  if (!Number.isSafeInteger(value) || value < 0) throw badRequest(`${label} debe ser un entero no negativo seguro`, 'INVALID_AMOUNT');
  return BigInt(value);
}

function parsePositiveDecimal(value: string): { numerator: bigint; denominator: bigint } {
  if (!/^\d{1,12}(\.\d{1,12})?$/.test(value)) throw badRequest('La tasa de cambio debe ser un decimal positivo con hasta 12 cifras decimales', 'INVALID_FX_RATE');
  const [whole, fraction = ''] = value.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction);
  if (numerator <= 0n) throw badRequest('La tasa de cambio debe ser mayor que cero', 'INVALID_FX_RATE');
  return { numerator, denominator };
}
export function convertMinorAmount(amountMinor: bigint, sourceCurrency: string, targetCurrency: string, rate: string): bigint {
  if (sourceCurrency === targetCurrency) return amountMinor;
  const sourceExponent = currencyExponent(sourceCurrency);
  const targetExponent = currencyExponent(targetCurrency);
  const { numerator, denominator } = parsePositiveDecimal(rate);
  const top = amountMinor * numerator * (10n ** BigInt(targetExponent));
  const bottom = denominator * (10n ** BigInt(sourceExponent));
  const quotient = top / bottom;
  const remainder = top % bottom;
  // Half-up rounding, fully integer and deterministic.
  return remainder * 2n >= bottom ? quotient + 1n : quotient;
}
export function decimalToBasisPoints(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw badRequest('Porcentaje fuera de rango', 'INVALID_SPLIT');
  const raw = String(value);
  const fraction = raw.split('.')[1] ?? '';
  if (fraction.length > 2) throw badRequest('Usa como máximo dos decimales para los porcentajes', 'INVALID_SPLIT');
  const points = Math.round(value * 100);
  if (!Number.isInteger(points)) throw badRequest('Porcentaje inválido', 'INVALID_SPLIT');
  return points;
}


export type ConvertibleShare = { userId: string; amountMinor: bigint; percentageBasisPoints: number | null };
export type ConvertedShare = ConvertibleShare & { originalAmountMinor: bigint };
/**
 * Converts source-currency shares to a group's settlement currency using the saved FX rate.
 * Uses floor + largest-remainder allocation so all converted shares sum exactly to the already
 * rounded expense total; the original share is preserved for display/audit.
 */
export function convertSharesExact(
  shares: ConvertibleShare[], sourceCurrency: string, targetCurrency: string, rate: string, expectedTotal: bigint,
): ConvertedShare[] {
  if (sourceCurrency === targetCurrency) {
    const sum = shares.reduce((acc, item) => acc + item.amountMinor, 0n);
    if (sum !== expectedTotal) throw new Error('Share total does not match same-currency expense total');
    return shares.map(item => ({ ...item, originalAmountMinor: item.amountMinor }));
  }
  const { numerator, denominator } = parsePositiveDecimal(rate);
  const sourceExponent = currencyExponent(sourceCurrency);
  const targetExponent = currencyExponent(targetCurrency);
  const divisor = denominator * (10n ** BigInt(sourceExponent));
  const computed = shares.map(item => {
    const top = item.amountMinor * numerator * (10n ** BigInt(targetExponent));
    return { ...item, originalAmountMinor: item.amountMinor, amountMinor: top / divisor, remainder: top % divisor };
  });
  const floorTotal = computed.reduce((sum, item) => sum + item.amountMinor, 0n);
  let remaining = expectedTotal - floorTotal;
  if (remaining < 0n || remaining > BigInt(computed.length)) throw new Error('FX share allocation invariant failed');
  const order = [...computed].sort((a, b) => a.remainder === b.remainder ? a.userId.localeCompare(b.userId) : (a.remainder > b.remainder ? -1 : 1));
  for (let i = 0; remaining > 0n; i++, remaining--) order[i]!.amountMinor += 1n;
  const finalSum = computed.reduce((sum, item) => sum + item.amountMinor, 0n);
  if (finalSum !== expectedTotal) throw new Error('Converted shares do not match converted expense total');
  return computed.map(({ userId, amountMinor, originalAmountMinor, percentageBasisPoints }) => ({ userId, amountMinor, originalAmountMinor, percentageBasisPoints }));
}
