export type BalanceMember = { userId: string; userName: string; userAvatar?: string | null };
export type BalanceExpense = { paidBy: string; settlementAmountMinor: bigint; shares: { userId: string; amountMinor: bigint }[] };
export type ConfirmedSettlement = { fromUserId: string; toUserId: string; amountMinor: bigint; status: string };
export type TransferSuggestion = { fromUserId: string; toUserId: string; amountMinor: bigint };

export function calculateBalances(members: BalanceMember[], expenses: BalanceExpense[], settlementRows: ConfirmedSettlement[]) {
  const balances = new Map(members.map(member => [member.userId, 0n]));
  for (const expense of expenses) {
    if (balances.has(expense.paidBy)) balances.set(expense.paidBy, balances.get(expense.paidBy)! + expense.settlementAmountMinor);
    for (const share of expense.shares) if (balances.has(share.userId)) balances.set(share.userId, balances.get(share.userId)! - share.amountMinor);
  }
  for (const settlement of settlementRows) {
    if (settlement.status !== 'confirmed') continue;
    if (balances.has(settlement.fromUserId)) balances.set(settlement.fromUserId, balances.get(settlement.fromUserId)! + settlement.amountMinor);
    if (balances.has(settlement.toUserId)) balances.set(settlement.toUserId, balances.get(settlement.toUserId)! - settlement.amountMinor);
  }
  const total = [...balances.values()].reduce((sum, value) => sum + value, 0n);
  if (total !== 0n) throw new Error(`Invariante financiera rota: balance neto de grupo ${total.toString()} (debe ser 0)`);
  return balances;
}

/** Deterministic greedy settlement plan. It reduces transfer count in typical cases, but is not claimed to be globally minimal for every possible graph. */
export function suggestTransfers(balances: Map<string, bigint>): TransferSuggestion[] {
  const debtors = [...balances].filter(([, amount]) => amount < 0n).map(([userId, amount]) => ({ userId, amount: -amount })).sort((a, b) => a.userId.localeCompare(b.userId));
  const creditors = [...balances].filter(([, amount]) => amount > 0n).map(([userId, amount]) => ({ userId, amount })).sort((a, b) => a.userId.localeCompare(b.userId));
  const suggestions: TransferSuggestion[] = [];
  let debtorIndex = 0; let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!; const creditor = creditors[creditorIndex]!;
    const amountMinor = debtor.amount < creditor.amount ? debtor.amount : creditor.amount;
    if (amountMinor > 0n) suggestions.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountMinor });
    debtor.amount -= amountMinor; creditor.amount -= amountMinor;
    if (debtor.amount === 0n) debtorIndex++;
    if (creditor.amount === 0n) creditorIndex++;
  }
  if (debtors.some(v => v.amount !== 0n) || creditors.some(v => v.amount !== 0n)) throw new Error('No fue posible liquidar todos los balances; revise la suma neta del grupo.');
  return suggestions;
}
