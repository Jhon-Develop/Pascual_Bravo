import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Router } from 'express';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../infrastructure/database/client.js';
import { auditEvents, expenses, expenseShares, groupMembers, groups, groupInvitations, groupRolePermissions, passwordResetTokens, receipts, sessions, settlements, users } from '../../infrastructure/database/schema.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { validateBody } from '../../shared/http/validate.js';
import { verifyPassword } from '../../shared/security/password.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';
import { conflict, unauthorized } from '../../shared/errors/app-error.js';
import { env } from '../../config/env.js';
import { groupBalanceSnapshot } from '../balances/balance.snapshot.js';

export const usersRouter = Router();
const updateProfileSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), avatarUrl: z.string().url().max(2048).nullable().optional(), locale: z.string().trim().min(2).max(20).optional(), timezone: z.string().trim().min(1).max(80).optional() }).refine(v => Object.keys(v).length > 0, 'Envía al menos un campo');
const deleteAccountSchema = z.object({ confirmation: z.literal('ELIMINAR MI CUENTA'), password: z.string().min(1).max(128) });

usersRouter.get('/me', requireAuth, (req, res) => res.json(req.auth!.user));
usersRouter.patch('/me', requireAuth, validateBody(updateProfileSchema), asyncHandler(async (req, res) => {
  const body = updateProfileSchema.parse(req.body); const userId = req.auth!.userId;
  await db.update(users).set({ ...body, updatedAt: new Date() }).where(eq(users.id, userId));
  await auditEvent({ requestId: req.requestId, actorUserId: userId, action: 'user.profile_update', resourceType: 'user', resourceId: userId, metadata: { fields: Object.keys(body) } });
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]!;
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), locale: user.locale, timezone: user.timezone });
}));

usersRouter.get('/me/export', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.auth!.userId;
  const user = (await db.select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, locale: users.locale, timezone: users.timezone, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users).where(eq(users.id, userId)).limit(1))[0];
  const memberships = await db.select({ member: groupMembers, group: groups }).from(groupMembers).innerJoin(groups, eq(groups.id, groupMembers.groupId)).where(eq(groupMembers.userId, userId));
  const userShareExpenseIds = await db.select({ expenseId: expenseShares.expenseId }).from(expenseShares).where(eq(expenseShares.userId, userId));
  const relatedExpenseIds = [...new Set(userShareExpenseIds.map(row => row.expenseId))];
  const expensePredicates = [or(eq(expenses.createdBy, userId), eq(expenses.paidBy, userId))!];
  if (relatedExpenseIds.length) expensePredicates.push(inArray(expenses.id, relatedExpenseIds));
  const expenseRows = await db.select().from(expenses).where(or(...expensePredicates));
  const exportedExpenseIds = expenseRows.map(expense => expense.id);
  const shareRows = exportedExpenseIds.length ? await db.select().from(expenseShares).where(inArray(expenseShares.expenseId, exportedExpenseIds)) : [];
  const settlementRows = await db.select().from(settlements).where(or(eq(settlements.fromUserId, userId), eq(settlements.toUserId, userId)));
  const receiptRows = exportedExpenseIds.length ? await db.select().from(receipts).where(inArray(receipts.expenseId, exportedExpenseIds)) : [];
  const audits = await db.select().from(auditEvents).where(eq(auditEvents.actorUserId, userId));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pazito-export-${userId}.json"`);
  res.json({ exportedAt: new Date().toISOString(), user, memberships: memberships.map(({ member, group }) => ({ role: member.role, status: member.status, joinedAt: member.joinedAt.toISOString(), group: { id: group.id, name: group.name, currency: group.currency, createdAt: group.createdAt.toISOString() } })),
    expenses: expenseRows.map(e => ({ ...e, amountMinor: e.amountMinor.toString(), settlementAmountMinor: e.settlementAmountMinor.toString() })),
    shares: shareRows.map(s => ({ ...s, amountMinor: s.amountMinor.toString(), originalAmountMinor: s.originalAmountMinor.toString() })),
    settlements: settlementRows.map(s => ({ ...s, amountMinor: s.amountMinor.toString() })),
    receipts: receiptRows.map(r => ({ id: r.id, expenseId: r.expenseId, originalName: r.originalName, mimeType: r.mimeType, sizeBytes: r.sizeBytes, sha256: r.sha256, createdAt: r.createdAt.toISOString() })),
    auditEvents: audits.map(a => ({ action: a.action, resourceType: a.resourceType, resourceId: a.resourceId, outcome: a.outcome, createdAt: a.createdAt.toISOString() })) });
}));

usersRouter.delete('/me', requireAuth, validateBody(deleteAccountSchema), asyncHandler(async (req, res) => {
  const userId = req.auth!.userId; const body = deleteAccountSchema.parse(req.body);
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]!;
  if (!(await verifyPassword(user.passwordHash, body.password))) throw unauthorized('La contraseña no es correcta');
  const memberships = await db.select({ member: groupMembers, group: groups }).from(groupMembers).innerJoin(groups, eq(groups.id, groupMembers.groupId)).where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, 'active')));
  // Prevent deleting the account while unresolved balances/payments would strand another member.
  for (const { group } of memberships) {
    const snapshot = await groupBalanceSnapshot(group.id);
    if ((snapshot.net.get(userId) ?? 0n) !== 0n) throw conflict(`Antes de eliminar tu cuenta, liquida tu saldo pendiente en el grupo "${group.name}"`, 'ACCOUNT_HAS_OUTSTANDING_BALANCE');
    const pending = await db.select({ id: settlements.id }).from(settlements).where(and(eq(settlements.groupId, group.id), or(eq(settlements.status, 'declared'), eq(settlements.status, 'disputed')), or(eq(settlements.fromUserId, userId), eq(settlements.toUserId, userId)))).limit(1);
    if (pending.length) throw conflict(`Resuelve las liquidaciones pendientes del grupo "${group.name}" antes de eliminar la cuenta`, 'ACCOUNT_HAS_PENDING_SETTLEMENT');
  }
  // Keep shared financial history; transfer ownership where possible, otherwise archive single-person groups.
  for (const { member, group } of memberships) {
    if (member.role !== 'owner') continue;
    const successor = (await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, 'active'), or(eq(groupMembers.role, 'admin'), eq(groupMembers.role, 'member')))).limit(1))[0];
    if (successor) {
      await db.transaction(async tx => {
        await tx.update(groupMembers).set({ role: 'owner' }).where(eq(groupMembers.id, successor.id));
        await tx.update(groupMembers).set({ role: 'member', status: 'left', leftAt: new Date() }).where(eq(groupMembers.id, member.id));
        await tx.update(groups).set({ createdBy: successor.userId, updatedAt: new Date() }).where(eq(groups.id, group.id));
        await tx.update(groupRolePermissions).set({ updatedBy: successor.userId, updatedAt: new Date() }).where(eq(groupRolePermissions.groupId, group.id));
        await tx.insert(auditEvents).values({ id: randomUUID(), actorUserId: userId, action: 'group.owner.transfer_on_account_delete', resourceType: 'group', resourceId: group.id, metadata: { successorUserId: successor.userId } });
      });
    } else {
      await db.update(groups).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(groups.id, group.id));
      await db.update(groupMembers).set({ status: 'left', leftAt: new Date() }).where(eq(groupMembers.id, member.id));
    }
  }
  const ownedReceipts = await db.select().from(receipts).where(eq(receipts.uploadedBy, userId));
  const receiptsPath = resolve(process.cwd(), env.RECEIPTS_DIR);
  const erasedEmail = `deleted+${userId}@deleted.invalid`;
  await db.transaction(async tx => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.update(groupMembers).set({ status: 'left', leftAt: new Date() }).where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, 'active')));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.update(groupInvitations).set({ status: 'revoked', revokedAt: new Date() }).where(and(eq(groupInvitations.invitedBy, userId), eq(groupInvitations.status, 'pending')));
    await tx.delete(receipts).where(eq(receipts.uploadedBy, userId));
    await tx.update(users).set({ email: erasedEmail, name: 'Usuario eliminado', avatarUrl: null, passwordHash: 'ACCOUNT_DELETED', deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
    await tx.update(groupInvitations).set({ invitedEmail: null }).where(eq(groupInvitations.invitedEmail, user.email));
    await auditEvent({ requestId: req.requestId, actorUserId: null, action: 'user.account_delete_anonymize', resourceType: 'user', resourceId: userId, metadata: { receiptsRemoved: ownedReceipts.length } }, tx);
  });
  // Remove private files only after the database transaction commits; a rollback must not orphan receipt rows.
  for (const receipt of ownedReceipts) await unlink(join(receiptsPath, receipt.storageKey)).catch(() => undefined);
  res.clearCookie(env.SESSION_COOKIE_NAME, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.status(204).end();
}));
