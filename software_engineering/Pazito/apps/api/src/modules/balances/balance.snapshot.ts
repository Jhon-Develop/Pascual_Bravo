import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, type DbTransaction } from '../../infrastructure/database/client.js';
import { expenses, expenseShares, groupMembers, groups, settlements, users } from '../../infrastructure/database/schema.js';
import { notFound } from '../../shared/errors/app-error.js';
import { calculateBalances, suggestTransfers } from './balance.service.js';

/** Load source records and derive the current official balance; use the caller's transaction for consistency when writing. */
export async function groupBalanceSnapshotFrom(tx: Pick<DbTransaction, 'select'>, groupId: string) {
  const group = (await tx.select().from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1))[0];
  if (!group) throw notFound('Grupo no encontrado');
  const members = await tx.select({ member: groupMembers, user: users }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(eq(groupMembers.groupId, groupId));
  const expenseRows = await tx.select().from(expenses).where(and(eq(expenses.groupId, groupId), isNull(expenses.archivedAt)));
  const expenseIds = expenseRows.map(expense => expense.id);
  const shares = expenseIds.length ? await tx.select().from(expenseShares).where(inArray(expenseShares.expenseId, expenseIds)) : [];
  const sharesByExpense = new Map<string, { userId: string; amountMinor: bigint }[]>();
  for (const share of shares) {
    if (!sharesByExpense.has(share.expenseId)) sharesByExpense.set(share.expenseId, []);
    sharesByExpense.get(share.expenseId)!.push({ userId: share.userId, amountMinor: share.amountMinor });
  }
  const confirmed = await tx.select().from(settlements).where(and(eq(settlements.groupId, groupId), eq(settlements.status, 'confirmed')));
  const net = calculateBalances(members.map(({ user }) => ({ userId: user.id, userName: user.name, userAvatar: user.avatarUrl })),
    expenseRows.map(expense => ({ paidBy: expense.paidBy, settlementAmountMinor: expense.settlementAmountMinor, shares: sharesByExpense.get(expense.id) ?? [] })),
    confirmed.map(settlement => ({ fromUserId: settlement.fromUserId, toUserId: settlement.toUserId, amountMinor: settlement.amountMinor, status: settlement.status })));
  return { group, members, expenses: expenseRows, net, transfers: suggestTransfers(net), confirmed };
}

export async function groupBalanceSnapshot(groupId: string) {
  return groupBalanceSnapshotFrom(db, groupId);
}
