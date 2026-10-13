import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  parseCurrencyInput,
  formatCurrencyInput,
  addCurrency,
  subtractCurrency,
  multiplyCurrency,
  divideCurrency,
  percentageOfCurrency,
  getCurrencyFractionDigits,
} from '../currency';

const normalizeCurrency = (str: string) => str.replace(/[\u202F\u00A0\s]/g, ' ').trim();

describe('Currency formatting and ISO-4217 minor units', () => {
  it('uses whole pesos for COP display while retaining ISO centavos internally', () => {
    expect(normalizeCurrency(formatCurrency(15000000, { currency: 'COP' }))).toBe('$ 150.000');
    expect(normalizeCurrency(formatCurrency(100000, { currency: 'COP' }))).toBe('$ 1.000');
    expect(normalizeCurrency(formatCurrency(0, { currency: 'COP' }))).toBe('$ 0');
    expect(normalizeCurrency(formatCurrency(-5000000, { currency: 'COP' }))).toBe('-$ 50.000');
  });

  it('uses cents for USD and EUR', () => {
    expect(normalizeCurrency(formatCurrency(150000, { currency: 'USD' }))).toBe('US$ 1.500,00');
    expect(normalizeCurrency(formatCurrency(1000, { currency: 'USD' }))).toBe('US$ 10,00');
    expect(getCurrencyFractionDigits('EUR')).toBe(2);
  });

  it('supports currencies with zero and three fraction digits', () => {
    expect(getCurrencyFractionDigits('COP')).toBe(2);
    expect(getCurrencyFractionDigits('JPY')).toBe(0);
    expect(getCurrencyFractionDigits('BHD')).toBe(3);
    expect(normalizeCurrency(formatCurrency(1234, { currency: 'BHD' }))).toContain('1,234');
  });

  it('treats null, undefined and invalid values as zero for display', () => {
    expect(normalizeCurrency(formatCurrency(null, { currency: 'COP' }))).toBe('$ 0');
    expect(normalizeCurrency(formatCurrency(undefined, { currency: 'COP' }))).toBe('$ 0');
    expect(normalizeCurrency(formatCurrency('not-a-number', { currency: 'COP' }))).toBe('$ 0');
  });

  describe('parseCurrencyInput', () => {
    it('parses COP grouping separators without dividing or truncating the amount', () => {
      expect(parseCurrencyInput('150000', 'COP')).toBe(15000000);
      expect(parseCurrencyInput('150.000', 'COP')).toBe(15000000);
      expect(parseCurrencyInput('150,000', 'COP')).toBe(15000000);
      expect(parseCurrencyInput('$ 150.000', 'COP')).toBe(15000000);
      expect(parseCurrencyInput('1.234.567', 'COP')).toBe(123456700);
      expect(parseCurrencyInput('150,50', 'COP')).toBe(15050);
    });

    it('parses decimal amounts and both common separator conventions', () => {
      expect(parseCurrencyInput('150.50', 'USD')).toBe(15050);
      expect(parseCurrencyInput('150,50', 'USD')).toBe(15050);
      expect(parseCurrencyInput('1.234,56', 'EUR')).toBe(123456);
      expect(parseCurrencyInput('1,234.56', 'USD')).toBe(123456);
      expect(parseCurrencyInput('$ 1.234,56', 'EUR')).toBe(123456);
    });

    it('rejects unsupported precision, negative values, and currency text', () => {
      expect(parseCurrencyInput('', 'COP')).toBeNull();
      expect(parseCurrencyInput('abc', 'COP')).toBeNull();
      expect(parseCurrencyInput('-100', 'COP')).toBeNull();
      expect(parseCurrencyInput('USD 150.50', 'USD')).toBeNull();
      expect(parseCurrencyInput('1.234', 'USD')).toBe(123400); // grouping convention: 1,234 USD in cents
      expect(parseCurrencyInput('150.500', 'USD')).toBe(15050000); // grouping convention: 150,500 USD in cents
      expect(parseCurrencyInput('12.3456', 'USD')).toBeNull();
    });

    it('supports three-decimal currencies', () => {
      expect(parseCurrencyInput('1.234', 'BHD')).toBe(1234000); // 3 digits => grouping under the documented ambiguity rule
      expect(parseCurrencyInput('1.2345', 'BHD')).toBeNull();
      expect(parseCurrencyInput('1,234.567', 'BHD')).toBe(1234567);
    });
  });

  describe('formatCurrencyInput', () => {
    it('formats COP as whole pesos', () => {
      expect(formatCurrencyInput(15000000, 'COP')).toBe('150000');
      expect(formatCurrencyInput(0, 'COP')).toBe('0');
    });

    it('formats USD with two decimal places', () => {
      expect(formatCurrencyInput(15050, 'USD')).toBe('150.50');
      expect(formatCurrencyInput(1000, 'USD')).toBe('10.00');
    });

    it('handles null and invalid values', () => {
      expect(formatCurrencyInput(null, 'COP')).toBe('');
      expect(formatCurrencyInput(undefined, 'COP')).toBe('');
      expect(formatCurrencyInput('invalid', 'COP')).toBe('');
    });
  });

  describe('Integer arithmetic', () => {
    it('adds and subtracts correctly', () => {
      expect(addCurrency(100000, 50000)).toBe(150000);
      expect(subtractCurrency(150000, 50000)).toBe(100000);
    });

    it('multiplies and rounds to a minor unit', () => {
      expect(multiplyCurrency(10000, 0.5)).toBe(5000);
      expect(multiplyCurrency(10000, 3)).toBe(30000);
    });

    it('distributes positive remainder deterministically', () => {
      expect(divideCurrency(10, 3)).toEqual([4, 3, 3]);
      expect(divideCurrency(150, 3)).toEqual([50, 50, 50]);
    });

    it('distributes negative amounts while preserving the total', () => {
      expect(divideCurrency(-10, 3)).toEqual([-4, -3, -3]);
      expect(divideCurrency(-1, 3)).toEqual([-1, 0, 0]);
      expect(divideCurrency(10, 0)).toEqual([]);
      expect(divideCurrency(10, 1.5)).toEqual([]);
    });

    it('calculates percentages', () => {
      expect(percentageOfCurrency(10000, 50)).toBe(5000);
      expect(percentageOfCurrency(10000, 33.33)).toBe(3333);
    });
  });
});
