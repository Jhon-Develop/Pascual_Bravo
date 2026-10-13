import { describe, expect, it } from 'vitest';
import { calculateShares } from '../../src/modules/expenses/split.service.js';

describe('calculateShares', () => {
  it('divides integer minor units deterministically and conserves the total', () => {
    const shares = calculateShares(10n, 'equal', [{ userId: 'b' }, { userId: 'a' }, { userId: 'c' }]);
    expect(shares.map(x => [x.userId, x.amountMinor])).toEqual([['a', 4n], ['b', 3n], ['c', 3n]]);
    expect(shares.reduce((sum, x) => sum + x.amountMinor, 0n)).toBe(10n);
  });

  it('rejects custom shares whose sum is not exactly the expense amount', () => {
    expect(() => calculateShares(100n, 'custom', [
      { userId: 'a', amountMinor: 40 }, { userId: 'b', amountMinor: 50 },
    ])).toThrow(/coincidir exactamente/);
  });

  it('accepts percentages summing to 100% and assigns residues deterministically', () => {
    const shares = calculateShares(1001n, 'percentage', [
      { userId: 'b', percentage: 33.33 }, { userId: 'a', percentage: 33.33 }, { userId: 'c', percentage: 33.34 },
    ]);
    expect(shares.reduce((sum, x) => sum + x.amountMinor, 0n)).toBe(1001n);
    expect(shares.every(x => x.amountMinor >= 0n)).toBe(true);
    expect(shares.find(x => x.userId === 'a')?.percentageBasisPoints).toBe(3333);
  });
});
