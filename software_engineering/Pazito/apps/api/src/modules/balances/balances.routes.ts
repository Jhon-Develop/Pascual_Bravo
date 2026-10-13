import { Router } from 'express';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { groupMembers } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { assertGroupPermission } from '../groups/permissions.service.js';
import { groupBalanceSnapshot } from './balance.snapshot.js';
import { toSafeAmount } from '../../shared/validation/currency.js';

export const balancesRouter = Router();
const safe = (v: bigint) => toSafeAmount(v);

balancesRouter.get('/groups/:groupId/balances', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); await assertGroupPermission(groupId, req.auth!.userId, 'group:read');
  const snapshot = await groupBalanceSnapshot(groupId);
  const balances = snapshot.members.filter(m => m.member.status === 'active').map(({ user }) => ({ userId: user.id, userName: user.name, userAvatar: user.avatarUrl, balanceMinor: safe(snapshot.net.get(user.id) ?? 0n) }));
  const totalExpensesMinor = snapshot.expenses.reduce((sum, expense) => sum + expense.settlementAmountMinor, 0n);
  const userBalance = balances.find(b => b.userId === req.auth!.userId) ?? { userId: req.auth!.userId, userName: req.auth!.user.name, balanceMinor: 0 };
  res.json({ groupId, groupName: snapshot.group.name, currency: snapshot.group.currency, balances, totalExpensesMinor: safe(totalExpensesMinor), userBalance });
}));

balancesRouter.get('/groups/:groupId/balances/detail', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); await assertGroupPermission(groupId, req.auth!.userId, 'group:read');
  const snapshot = await groupBalanceSnapshot(groupId);
  const names = new Map(snapshot.members.map(({ user }) => [user.id, user]));
  const output = snapshot.transfers.map(transfer => {
    const from = names.get(transfer.fromUserId); const to = names.get(transfer.toUserId);
    return { fromUserId: transfer.fromUserId, fromUserName: from?.name ?? 'Usuario', fromUserAvatar: from?.avatarUrl ?? null,
      toUserId: transfer.toUserId, toUserName: to?.name ?? 'Usuario', toUserAvatar: to?.avatarUrl ?? null,
      amountMinor: safe(transfer.amountMinor), expenses: snapshot.expenses.filter(e => e.paidBy === transfer.toUserId).slice(0, 10).map(e => ({ id: e.id, title: e.title, date: e.date, amountMinor: safe(e.settlementAmountMinor) })) };
  });
  res.json(output);
}));
