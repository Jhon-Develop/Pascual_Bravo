/**
 * Exact currency helpers.
 *
 * Amounts are stored as integers in the currency's ISO-4217 minor unit. COP,
 * USD and EUR use 2 fractional digits; JPY uses 0; BHD uses 3. For usability,
 * this app displays COP without decimal digits by default, while still storing
 * its ISO minor unit (centavos) exactly. Do not infer storage precision from display.
 */
export type CurrencyCode = 'COP' | 'USD' | 'EUR' | string;

export interface CurrencyFormatOptions {
  currency?: CurrencyCode;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'compact' | 'scientific' | 'engineering';
}

export const DEFAULT_CURRENCY: CurrencyCode = 'COP';
export const DEFAULT_LOCALE = 'es-CO';

/** Return the ISO-4217 minor-unit precision for a currency. */
export function getCurrencyFractionDigits(currency: CurrencyCode = DEFAULT_CURRENCY): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

const currencyScale = (currency: CurrencyCode) => 10 ** getCurrencyFractionDigits(currency);

export function formatCurrency(
  amountMinor: number | string | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  const currency = options.currency ?? DEFAULT_CURRENCY;
  const locale = options.locale ?? DEFAULT_LOCALE;
  if (amountMinor === null || amountMinor === undefined || amountMinor === '') return formatZero(currency, locale);

  const amount = typeof amountMinor === 'string' ? Number(amountMinor) : amountMinor;
  if (!Number.isSafeInteger(amount)) return formatZero(currency, locale);

  const fractionDigits = getCurrencyFractionDigits(currency);
  const displayFractionDigits = currency === 'COP' ? 0 : fractionDigits;
  const majorAmount = amount / currencyScale(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: options.minimumFractionDigits ?? displayFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits ?? displayFractionDigits,
      notation: options.notation ?? 'standard',
    }).format(majorAmount);
  } catch {
    return `${currency} ${majorAmount.toFixed(fractionDigits)}`;
  }
}

function formatZero(currency: CurrencyCode, locale = DEFAULT_LOCALE): string {
  const digits = currency === 'COP' ? 0 : getCurrencyFractionDigits(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(0);
  } catch {
    return `${currency} ${digits ? (0).toFixed(digits) : '0'}`;
  }
}

function isValidGroupedInteger(value: string): boolean {
  return /^\d{1,3}(?:[.,]\d{3})+$/.test(value);
}

/**
 * Parse a human-entered amount into integer ISO-4217 minor units.
 * Accepts both `1.234,56` and `1,234.56`, currency `$` symbols, and grouping
 * separators. Ambiguous single separators followed by exactly 3 digits are
 * interpreted as grouping separators (e.g. `150.000` means 150000 COP).
 * Negative values and currency-code prefixes are deliberately rejected.
 */
export function parseCurrencyInput(input: string, currency: CurrencyCode = DEFAULT_CURRENCY): number | null {
  if (!input || input.trim() === '') return null;

  const cleaned = input.replace(/[\s\u00a0\u202f$]/g, '');
  if (!cleaned || !/^\d+(?:[.,]\d+)*$/.test(cleaned)) return null;

  const fractionDigits = getCurrencyFractionDigits(currency);
  let integerPart = cleaned;
  let fractionalPart = '';
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  if (hasDot && hasComma) {
    if (fractionDigits === 0) return null;
    const decimalSeparator = cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',') ? '.' : ',';
    const splitAt = cleaned.lastIndexOf(decimalSeparator);
    integerPart = cleaned.slice(0, splitAt);
    fractionalPart = cleaned.slice(splitAt + 1);
    if (!fractionalPart || fractionalPart.length > fractionDigits || !/^\d+$/.test(fractionalPart)) return null;
    if (!/^\d+(?:[.,]\d{3})*$/.test(integerPart)) return null;
    integerPart = integerPart.replace(/[.,]/g, '');
  } else if (hasDot || hasComma) {
    const separator = hasDot ? '.' : ',';
    const parts = cleaned.split(separator);
    if (parts.length > 2) {
      if (!isValidGroupedInteger(cleaned)) return null;
      integerPart = cleaned.replace(/[.,]/g, '');
    } else {
      const [whole, fraction = ''] = parts;
      if (!whole || !fraction) return null;
      if (fraction.length === 3 && isValidGroupedInteger(cleaned)) {
        integerPart = cleaned.replace(/[.,]/g, '');
      } else {
        if (fractionDigits === 0 || fraction.length > fractionDigits) return null;
        integerPart = whole;
        fractionalPart = fraction;
      }
    }
  }

  if (!/^\d+$/.test(integerPart) || (fractionalPart && !/^\d+$/.test(fractionalPart))) return null;

  try {
    const scale = 10n ** BigInt(fractionDigits);
    const major = BigInt(integerPart);
    const minorFraction = BigInt((fractionalPart || '').padEnd(fractionDigits, '0') || '0');
    const result = major * scale + minorFraction;
    if (result > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(result);
  } catch {
    return null;
  }
}

/** Format integer minor units for a plain numeric input (no symbol/grouping). */
export function formatCurrencyInput(
  amountMinor: number | string | null | undefined,
  currency: CurrencyCode = DEFAULT_CURRENCY
): string {
  if (amountMinor === null || amountMinor === undefined || amountMinor === '') return '';
  const amount = typeof amountMinor === 'string' ? Number(amountMinor) : amountMinor;
  if (!Number.isSafeInteger(amount)) return '';
  const digits = currency === 'COP' ? 0 : getCurrencyFractionDigits(currency);
  return (amount / currencyScale(currency)).toFixed(digits);
}

export function addCurrency(a: number, b: number): number {
  return a + b;
}

export function subtractCurrency(a: number, b: number): number {
  return a - b;
}

export function multiplyCurrency(amount: number, factor: number): number {
  return Math.round(amount * factor);
}

/** Distribute integer minor units evenly and deterministically, including negatives. */
export function divideCurrency(amount: number, divisor: number): number[] {
  if (!Number.isSafeInteger(amount) || !Number.isInteger(divisor) || divisor <= 0) return [];
  const base = Math.trunc(amount / divisor);
  const remainder = amount - base * divisor;
  const remainderCount = Math.abs(remainder);
  const direction = Math.sign(remainder);
  return Array.from({ length: divisor }, (_, index) => base + (index < remainderCount ? direction : 0));
}

export function percentageOfCurrency(amount: number, percentage: number): number {
  return Math.round((amount * percentage) / 100);
}
