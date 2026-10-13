import { describe, expect, it } from 'vitest';
import { convertMinorAmount, convertSharesExact, currencyExponent, isValidCurrency } from '../../src/shared/validation/currency.js';

describe('exact currency arithmetic', () => {
  it('uses currency fraction digits explicitly', () => {
    expect(currencyExponent('COP')).toBe(2);
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
    expect(isValidCurrency('ZZZ')).toBe(false);
  });

  it('converts without binary floating point and rounds half-up', () => {
    expect(convertMinorAmount(10000n, 'USD', 'COP', '4000')).toBe(40000000n);
    expect(convertMinorAmount(1n, 'USD', 'USD', '1')).toBe(1n);
  });

  it('allocates FX rounding residue while preserving the converted total', () => {
    const converted = convertSharesExact([
      { userId: 'a', amountMinor: 3333n, percentageBasisPoints: 3333 },
      { userId: 'b', amountMinor: 3333n, percentageBasisPoints: 3333 },
      { userId: 'c', amountMinor: 3334n, percentageBasisPoints: 3334 },
    ], 'USD', 'COP', '4000', 40000000n);
    expect(converted.reduce((sum, row) => sum + row.amountMinor, 0n)).toBe(40000000n);
    expect(converted.reduce((sum, row) => sum + row.originalAmountMinor, 0n)).toBe(10000n);
  });
});
