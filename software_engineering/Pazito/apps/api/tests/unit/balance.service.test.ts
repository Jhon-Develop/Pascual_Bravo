import { describe, expect, it } from 'vitest';
import { calculateBalances, suggestTransfers } from '../../src/modules/balances/balance.service.js';

const members = ['alice', 'bob', 'carol'].map(userId => ({ userId, userName: userId }));

describe('balances', () => {
  it('has net zero and counts only confirmed settlements', () => {
    const net = calculateBalances(members, [{ paidBy: 'alice', settlementAmountMinor: 900n, shares: [
      { userId: 'alice', amountMinor: 300n }, { userId: 'bob', amountMinor: 300n }, { userId: 'carol', amountMinor: 300n },
    ] }], [
      { fromUserId: 'bob', toUserId: 'alice', amountMinor: 100n, status: 'declared' },
    ]);
    expect(net.get('alice')).toBe(600n);
    expect(net.get('bob')).toBe(-300n);
    expect(net.get('carol')).toBe(-300n);
    expect([...net.values()].reduce((sum, value) => sum + value, 0n)).toBe(0n);
  });

  it('generates deterministic suggestions covering every debt', () => {
    const suggestions = suggestTransfers(new Map([['alice', 0n], ['bob', -70n], ['carol', 30n], ['dan', 40n]]));
    expect(suggestions).toEqual([
      { fromUserId: 'bob', toUserId: 'carol', amountMinor: 30n },
      { fromUserId: 'bob', toUserId: 'dan', amountMinor: 40n },
    ]);
    expect(suggestions.reduce((sum, transfer) => sum + transfer.amountMinor, 0n)).toBe(70n);
  });
});
