import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { createSettlementSchema, disputeSettlementSchema, paginationSchema } from '@pazito/contracts';
import { db } from '../../infrastructure/database/client.js';
import { groupMembers, groups, settlements, settlementEvents, users } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { validateBody } from '../../shared/http/validate.js';
import { assertGroupPermission, assertGroupPermissionTx } from '../groups/permissions.service.js';
import { groupBalanceSnapshot, groupBalanceSnapshotFrom } from '../balances/balance.snapshot.js';
import { withIdempotency } from '../../infrastructure/database/idempotency.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../shared/errors/app-error.js';
import { toSafeAmount } from '../../shared/validation/currency.js';

export const settlementsRouter = Router();
const safe = (v: bigint) => toSafeAmount(v);
const pendingStatuses = ['declared', 'disputed'] as const;

async function dto(id: string, requesterId: string) {
  const rows = await db.select({ settlement: settlements })
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, settlements.groupId), eq(groupMembers.userId, requesterId), eq(groupMembers.status, 'active')))
    .where(eq(settlements.id, id)).limit(1);
  const settlement = rows[0]?.settlement;
  if (!settlement) throw notFound('Liquidación no encontrada');
  const parties = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, [settlement.fromUserId, settlement.toUserId]));
  const from = parties.find(p => p.id === settlement.fromUserId); const to = parties.find(p => p.id === settlement.toUserId);
  return { id: settlement.id, groupId: settlement.groupId, fromUserId: settlement.fromUserId, fromUserName: from?.name ?? 'Usuario', fromUserAvatar: from?.avatarUrl ?? null,
    toUserId: settlement.toUserId, toUserName: to?.name ?? 'Usuario', toUserAvatar: to?.avatarUrl ?? null, amountMinor: safe(settlement.amountMinor), currency: settlement.currency,
    status: settlement.status, declaredAt: settlement.declaredAt.toISOString(), confirmedAt: settlement.confirmedAt?.toISOString() ?? null,
    disputedAt: settlement.disputedAt?.toISOString() ?? null, disputeReason: settlement.disputeReason, createdAt: settlement.createdAt.toISOString(), updatedAt: settlement.updatedAt.toISOString() };
}

/** Pending declarations reserve the corresponding balance so that several offline clients cannot over-declare the same debt. */
async function applyPendingReservations(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], groupId: string, net: Map<string, bigint>) {
  const pending = await tx.select().from(settlements).where(and(eq(settlements.groupId, groupId), or(eq(settlements.status, 'declared'), eq(settlements.status, 'disputed'))));
  for (const item of pending) {
    net.set(item.fromUserId, (net.get(item.fromUserId) ?? 0n) + item.amountMinor);
    net.set(item.toUserId, (net.get(item.toUserId) ?? 0n) - item.amountMinor);
  }
  return net;
}

settlementsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { page, limit } = paginationSchema.parse(req.query); const queryGroup = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
  const members = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active')));
  const groupIds = members.map(m => m.groupId).filter(id => !queryGroup || queryGroup === id);
  if (queryGroup && !groupIds.length) throw notFound('Grupo no encontrado');
  if (!groupIds.length) return res.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
  const rows = await db.select({ id: settlements.id }).from(settlements).where(inArray(settlements.groupId, groupIds)).orderBy(desc(settlements.createdAt)).limit(limit).offset((page - 1) * limit);
  const totalRows = await db.select({ total: count() }).from(settlements).where(inArray(settlements.groupId, groupIds)); const total = Number(totalRows[0]?.total ?? 0);
  const data = await Promise.all(rows.map(row => dto(row.id, req.auth!.userId)));
  res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

settlementsRouter.post('/', requireAuth, validateBody(createSettlementSchema), asyncHandler(async (req, res) => {
  const body = createSettlementSchema.parse(req.body); const actorId = req.auth!.userId;
  if (body.toUserId === actorId) throw badRequest('No puedes liquidarte a ti mismo', 'INVALID_SETTLEMENT_PARTIES');
  // A quick read makes errors fast, but the authoritative checks happen below under the locked group row.
  await assertGroupPermission(body.groupId, actorId, 'settlements:create');
  const preflight = await groupBalanceSnapshot(body.groupId);
  if (!preflight.members.some(m => m.member.userId === body.toUserId && m.member.status === 'active')) throw notFound('La persona receptora no pertenece al grupo');
  const amount = BigInt(body.amountMinor); const id = randomUUID(); const now = new Date();
  const { result, replayed } = await withIdempotency(actorId, 'POST:/settlements', req.header('Idempotency-Key'), body, async tx => {
    const group = (await tx.select().from(groups).where(and(eq(groups.id, body.groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    await assertGroupPermissionTx(tx, body.groupId, actorId, 'settlements:create');
    const target = (await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.userId, body.toUserId), eq(groupMembers.status, 'active'))).limit(1))[0];
    if (!target) throw notFound('La persona receptora no pertenece al grupo');
    const snapshot = await groupBalanceSnapshotFrom(tx, body.groupId);
    const projected = await applyPendingReservations(tx, body.groupId, new Map(snapshot.net));
    const fromBalance = projected.get(actorId) ?? 0n; const toBalance = projected.get(body.toUserId) ?? 0n;
    if (fromBalance >= 0n || toBalance <= 0n || amount > -fromBalance || amount > toBalance) throw unprocessable('La liquidación debe ser entre una persona deudora y una acreedora y no puede superar el saldo disponible tras otras liquidaciones pendientes', 'SETTLEMENT_EXCEEDS_BALANCE');
    await tx.insert(settlements).values({ id, groupId: body.groupId, fromUserId: actorId, toUserId: body.toUserId, amountMinor: amount, currency: group.currency, status: 'declared', declaredAt: now, createdAt: now, updatedAt: now });
    await tx.insert(settlementEvents).values({ id: randomUUID(), settlementId: id, actorUserId: actorId, event: 'declared' });
    await auditEvent({ requestId: req.requestId, actorUserId: actorId, action: 'settlement.declare', resourceType: 'settlement', resourceId: id, metadata: { groupId: body.groupId, status: 'declared' } }, tx);
    return { id, groupId: body.groupId, fromUserId: actorId, toUserId: body.toUserId, amountMinor: body.amountMinor, currency: group.currency, status: 'declared', declaredAt: now.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() };
  });
  res.setHeader('Idempotency-Replayed', String(replayed)); res.status(replayed ? 200 : 201).json(await dto(result.id, actorId));
}));

settlementsRouter.post('/:settlementId/confirm', requireAuth, asyncHandler(async (req, res) => {
  const id = String(req.params.settlementId); const actorId = req.auth!.userId;
  const initial = (await db.select().from(settlements).where(eq(settlements.id, id)).limit(1))[0];
  if (!initial) throw notFound('Liquidación no encontrada');
  if (initial.toUserId !== actorId) throw forbidden('Solo la persona receptora puede confirmar la liquidación');
  await db.transaction(async tx => {
    const group = (await tx.select().from(groups).where(eq(groups.id, initial.groupId)).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const current = (await tx.select().from(settlements).where(eq(settlements.id, id)).limit(1).for('update'))[0];
    if (!current) throw notFound('Liquidación no encontrada');
    await assertGroupPermissionTx(tx, current.groupId, actorId, 'settlements:confirm');
    if (current.toUserId !== actorId) throw forbidden('Solo la persona receptora puede confirmar la liquidación');
    if (current.status === 'confirmed') return; // idempotent repeat; don't add duplicate history event
    if (current.status !== 'declared') throw conflict('Solo pueden confirmarse liquidaciones declaradas; una disputada debe cancelarse y registrarse de nuevo', 'INVALID_SETTLEMENT_STATE');
    const now = new Date();
    await tx.update(settlements).set({ status: 'confirmed', confirmedAt: now, updatedAt: now }).where(and(eq(settlements.id, id), eq(settlements.status, 'declared')));
    await tx.insert(settlementEvents).values({ id: randomUUID(), settlementId: id, actorUserId: actorId, event: 'confirmed' });
    await auditEvent({ requestId: req.requestId, actorUserId: actorId, action: 'settlement.confirm', resourceType: 'settlement', resourceId: id, metadata: { status: 'confirmed' } }, tx);
  });
  res.json(await dto(id, actorId));
}));

settlementsRouter.post('/:settlementId/dispute', requireAuth, validateBody(disputeSettlementSchema), asyncHandler(async (req, res) => {
  const id = String(req.params.settlementId); const actorId = req.auth!.userId; const { reason } = disputeSettlementSchema.parse(req.body);
  const initial = (await db.select().from(settlements).where(eq(settlements.id, id)).limit(1))[0];
  if (!initial) throw notFound('Liquidación no encontrada');
  if (initial.toUserId !== actorId) throw forbidden('Solo la persona receptora puede disputar la liquidación');
  await db.transaction(async tx => {
    const group = (await tx.select().from(groups).where(eq(groups.id, initial.groupId)).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const current = (await tx.select().from(settlements).where(eq(settlements.id, id)).limit(1).for('update'))[0];
    if (!current) throw notFound('Liquidación no encontrada');
    await assertGroupPermissionTx(tx, current.groupId, actorId, 'settlements:dispute');
    if (current.toUserId !== actorId) throw forbidden('Solo la persona receptora puede disputar la liquidación');
    if (current.status === 'disputed') return;
    if (current.status !== 'declared') throw conflict('Solo pueden disputarse liquidaciones declaradas', 'INVALID_SETTLEMENT_STATE');
    const now = new Date();
    await tx.update(settlements).set({ status: 'disputed', disputedAt: now, disputeReason: reason, updatedAt: now }).where(and(eq(settlements.id, id), eq(settlements.status, 'declared')));
    await tx.insert(settlementEvents).values({ id: randomUUID(), settlementId: id, actorUserId: actorId, event: 'disputed', reason });
    await auditEvent({ requestId: req.requestId, actorUserId: actorId, action: 'settlement.dispute', resourceType: 'settlement', resourceId: id, metadata: { status: 'disputed' } }, tx);
  });
  res.json(await dto(id, actorId));
}));

settlementsRouter.post('/:settlementId/cancel', requireAuth, asyncHandler(async (req, res) => {
  const id = String(req.params.settlementId); const actorId = req.auth!.userId;
  const initial = (await db.select().from(settlements).where(eq(settlements.id, id)).limit(1))[0];
  if (!initial) throw notFound('Liquidación no encontrada');
  if (initial.fromUserId !== actorId) throw forbidden('Solo quien declaró el pago puede cancelarlo');
  await db.transaction(async tx => {
    const group = (await tx.select().from(groups).where(eq(groups.id, initial.groupId)).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const current = (await tx.select().from(settlements).where(eq(settlements.id, id)).limit(1).for('update'))[0];
    if (!current) throw notFound('Liquidación no encontrada');
    await assertGroupPermissionTx(tx, current.groupId, actorId, 'settlements:create');
    if (current.fromUserId !== actorId) throw forbidden('Solo quien declaró el pago puede cancelarlo');
    if (current.status === 'cancelled') return;
    if (!pendingStatuses.includes(current.status as typeof pendingStatuses[number])) throw conflict('Esta liquidación ya no puede cancelarse', 'INVALID_SETTLEMENT_STATE');
    const now = new Date();
    await tx.update(settlements).set({ status: 'cancelled', updatedAt: now }).where(eq(settlements.id, id));
    await tx.insert(settlementEvents).values({ id: randomUUID(), settlementId: id, actorUserId: actorId, event: 'cancelled' });
    await auditEvent({ requestId: req.requestId, actorUserId: actorId, action: 'settlement.cancel', resourceType: 'settlement', resourceId: id, metadata: { status: 'cancelled' } }, tx);
  });
  res.json(await dto(id, actorId));
}));
