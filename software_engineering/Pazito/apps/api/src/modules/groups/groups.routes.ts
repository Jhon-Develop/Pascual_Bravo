import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { Router } from 'express';
import { createGroupSchema, paginationSchema, updateGroupSchema, updateMemberRoleSchema, updatePermissionsSchema, transferOwnershipSchema } from '@pazito/contracts';
import { db } from '../../infrastructure/database/client.js';
import { expenses, groupMembers, groupRolePermissions, groups, settlements, users } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { validateBody } from '../../shared/http/validate.js';
import { assertGroupPermission, assertGroupPermissionTx, DEFAULT_PERMISSIONS, getMembership, permissionsFor } from './permissions.service.js';
import { withIdempotency } from '../../infrastructure/database/idempotency.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';
import { conflict, forbidden, notFound, unprocessable } from '../../shared/errors/app-error.js';
import { groupBalanceSnapshotFrom } from '../balances/balance.snapshot.js';
import { isValidCurrency } from '../../shared/validation/currency.js';

export const groupsRouter = Router();
const iso = (d: Date | null | undefined) => d ? d.toISOString() : null;

async function groupDTO(groupId: string, userId: string, withMembers = false) {
  const rows = await db.select({ group: groups, role: groupMembers.role }).from(groups).innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId), eq(groupMembers.status, 'active'))).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1);
  if (!rows[0]) throw notFound('No se encontró el grupo');
  const record = rows[0];
  const allMembers = withMembers ? await db.select({ member: groupMembers, user: users }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, 'active'))).orderBy(asc(groupMembers.joinedAt)) : [];
  return {
    id: record.group.id, name: record.group.name, description: record.group.description, avatarUrl: record.group.avatarUrl,
    currency: record.group.currency, locale: record.group.locale, timezone: record.group.timezone, createdBy: record.group.createdBy,
    createdAt: record.group.createdAt.toISOString(), updatedAt: record.group.updatedAt.toISOString(), archivedAt: iso(record.group.archivedAt),
    memberCount: withMembers ? allMembers.length : await countActiveMembers(groupId), userRole: record.role,
    ...(withMembers ? { members: allMembers.map(({ member, user }) => ({ id: member.id, groupId: member.groupId, userId: member.userId, role: member.role, joinedAt: member.joinedAt.toISOString(), user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } })) } : {}),
  };
}
async function countActiveMembers(groupId: string) {
  const value = await db.select({ total: count() }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, 'active')));
  return Number(value[0]?.total ?? 0);
}
groupsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { page, limit } = paginationSchema.parse(req.query); const offset = (page - 1) * limit;
  const memberships = await db.select({ groupId: groupMembers.groupId, role: groupMembers.role }).from(groupMembers).where(and(eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active')));
  const ids = memberships.map(m => m.groupId);
  if (!ids.length) return res.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
  const rows = await db.select().from(groups).where(and(inArray(groups.id, ids), isNull(groups.archivedAt))).orderBy(desc(groups.updatedAt)).limit(limit).offset(offset);
  const totalRows = await db.select({ total: count() }).from(groups).where(and(inArray(groups.id, ids), isNull(groups.archivedAt)));
  const data = await Promise.all(rows.map(g => groupDTO(g.id, req.auth!.userId)));
  const total = Number(totalRows[0]?.total ?? 0);
  res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

groupsRouter.post('/', requireAuth, validateBody(createGroupSchema), asyncHandler(async (req, res) => {
  const body = createGroupSchema.parse(req.body); if (!isValidCurrency(body.currency)) throw unprocessable('Código de moneda ISO 4217 no soportado', 'INVALID_CURRENCY'); const id = randomUUID(); const now = new Date();
  const { result, replayed } = await withIdempotency(req.auth!.userId, 'POST:/groups', req.header('Idempotency-Key'), body, async tx => {
    await tx.insert(groups).values({ id, name: body.name, description: body.description ?? null, currency: body.currency, locale: body.locale, timezone: body.timezone, createdBy: req.auth!.userId, createdAt: now, updatedAt: now });
    await tx.insert(groupMembers).values({ id: randomUUID(), groupId: id, userId: req.auth!.userId, role: 'owner', status: 'active', joinedAt: now });
    for (const role of ['admin', 'member'] as const) await tx.insert(groupRolePermissions).values({ id: randomUUID(), groupId: id, role, permissions: DEFAULT_PERMISSIONS[role], updatedBy: req.auth!.userId, updatedAt: now });
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'group.create', resourceType: 'group', resourceId: id }, tx);
    return { id, name: body.name, description: body.description ?? null, avatarUrl: null, currency: body.currency, locale: body.locale, timezone: body.timezone, createdBy: req.auth!.userId, createdAt: now.toISOString(), updatedAt: now.toISOString(), memberCount: 1, userRole: 'owner' as const };
  });
  res.setHeader('Idempotency-Replayed', String(replayed)); res.status(replayed ? 200 : 201).json(result);
}));

groupsRouter.get('/:groupId', requireAuth, asyncHandler(async (req, res) => res.json(await groupDTO(String(req.params.groupId), req.auth!.userId, true))));

groupsRouter.patch('/:groupId', requireAuth, validateBody(updateGroupSchema), asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const body = updateGroupSchema.parse(req.body);
  if (body.currency && !isValidCurrency(body.currency)) throw unprocessable('Código de moneda ISO 4217 no soportado', 'INVALID_CURRENCY');
  await db.transaction(async tx => {
    const current = (await tx.select().from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!current) throw notFound('Grupo no encontrado');
    await assertGroupPermissionTx(tx, groupId, req.auth!.userId, 'group:update');
    if (body.currency && body.currency !== current.currency) {
      // A group-level lock serializes this check with concurrent expense creation.
      const anyExpense = (await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.groupId, groupId)).limit(1))[0];
      const anySettlement = (await tx.select({ id: settlements.id }).from(settlements).where(eq(settlements.groupId, groupId)).limit(1))[0];
      if (anyExpense || anySettlement) throw conflict('No se puede cambiar la moneda de liquidación de un grupo con historial. Crea otro grupo o implementa un proceso explícito de conversión histórica.', 'GROUP_CURRENCY_LOCKED');
    }
    await tx.update(groups).set({ ...body, updatedAt: new Date() }).where(eq(groups.id, groupId));
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'group.update', resourceType: 'group', resourceId: groupId, metadata: { fields: Object.keys(body) } }, tx);
  });
  res.json(await groupDTO(groupId, req.auth!.userId, true));
}));

groupsRouter.delete('/:groupId', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId);
  await db.transaction(async tx => {
    const group = (await tx.select().from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const actor = await assertGroupPermissionTx(tx, groupId, req.auth!.userId, 'group:archive');
    if (actor.role !== 'owner') throw forbidden('Solo el propietario puede archivar un grupo');
    const snapshot = await groupBalanceSnapshotFrom(tx, groupId);
    const unsettled = (await tx.select({ id: settlements.id }).from(settlements).where(and(eq(settlements.groupId, groupId), or(eq(settlements.status, 'declared'), eq(settlements.status, 'disputed')))).limit(1))[0];
    if ([...snapshot.net.values()].some(value => value !== 0n) || unsettled) throw conflict('No se puede archivar un grupo con saldos pendientes o liquidaciones sin resolver', 'GROUP_HAS_PENDING_BALANCES');
    const now = new Date();
    await tx.update(groups).set({ archivedAt: now, updatedAt: now }).where(eq(groups.id, groupId));
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'group.archive', resourceType: 'group', resourceId: groupId }, tx);
  });
  res.status(204).end();
}));

groupsRouter.get('/:groupId/members', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); await assertGroupPermission(groupId, req.auth!.userId, 'members:read');
  const { page, limit } = paginationSchema.parse(req.query); const offset = (page - 1) * limit;
  const rows = await db.select({ member: groupMembers, user: users }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, 'active'))).orderBy(asc(groupMembers.joinedAt)).limit(limit).offset(offset);
  const totalRows = await db.select({ total: count() }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, 'active')));
  const total = Number(totalRows[0]?.total ?? 0);
  res.json({ data: rows.map(({ member, user }) => ({ id: member.id, groupId: member.groupId, userId: member.userId, role: member.role, joinedAt: member.joinedAt.toISOString(), user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }, permissions: member.role === 'owner' ? [] : undefined })), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

groupsRouter.patch('/:groupId/members/:memberId', requireAuth, validateBody(updateMemberRoleSchema), asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const memberId = String(req.params.memberId); const { role } = updateMemberRoleSchema.parse(req.body);
  let targetUserId = '';
  let targetJoinedAt = new Date();
  await db.transaction(async tx => {
    const group = (await tx.select({ id: groups.id }).from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const actor = await assertGroupPermissionTx(tx, groupId, req.auth!.userId, 'members:manage');
    const target = (await tx.select().from(groupMembers).where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId), eq(groupMembers.status, 'active'))).limit(1).for('update'))[0];
    if (!target) throw notFound('Miembro no encontrado');
    if (target.role === 'owner') throw conflict('No se puede cambiar el rol del propietario', 'OWNER_ROLE_IMMUTABLE');
    if (role === 'admin' && actor.role !== 'owner') throw forbidden('Solo el propietario puede asignar el rol de administrador');
    if (target.userId === req.auth!.userId && target.role !== role) throw conflict('No puedes cambiar tu propio rol', 'SELF_ROLE_CHANGE');
    await tx.update(groupMembers).set({ role }).where(eq(groupMembers.id, memberId));
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'group.member.role_change', resourceType: 'group_member', resourceId: memberId, metadata: { newRole: role } }, tx);
    targetUserId = target.userId; targetJoinedAt = target.joinedAt;
  });
  const user = (await db.select().from(users).where(eq(users.id, targetUserId)).limit(1))[0]!;
  res.json({ id: memberId, userId: targetUserId, groupId, role, joinedAt: targetJoinedAt.toISOString(), user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
}));

groupsRouter.delete('/:groupId/members/:memberId', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const memberId = String(req.params.memberId);
  await db.transaction(async tx => {
    const group = (await tx.select({ id: groups.id }).from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const target = (await tx.select().from(groupMembers).where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId), eq(groupMembers.status, 'active'))).limit(1).for('update'))[0];
    if (!target) throw notFound('Miembro no encontrado');
    const isSelf = target.userId === req.auth!.userId;
    if (!isSelf) await assertGroupPermissionTx(tx, groupId, req.auth!.userId, 'members:manage');
    else {
      const actorMembership = (await tx.select({ id: groupMembers.id }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active'))).limit(1))[0];
      if (!actorMembership) throw notFound('No se encontró el grupo');
    }
    if (target.role === 'owner') throw conflict('El propietario debe transferir la propiedad antes de salir del grupo', 'OWNER_CANNOT_LEAVE');
    const snapshot = await groupBalanceSnapshotFrom(tx, groupId);
    const net = snapshot.net.get(target.userId) ?? 0n;
    const openSettlement = (await tx.select({ id: settlements.id }).from(settlements).where(and(eq(settlements.groupId, groupId), or(eq(settlements.status, 'declared'), eq(settlements.status, 'disputed')), or(eq(settlements.fromUserId, target.userId), eq(settlements.toUserId, target.userId)))).limit(1))[0];
    if (net !== 0n || openSettlement) throw conflict('No se puede retirar a este miembro mientras tenga saldo o liquidaciones pendientes', 'MEMBER_HAS_PENDING_BALANCE');
    const now = new Date();
    await tx.update(groupMembers).set({ status: 'left', leftAt: now }).where(eq(groupMembers.id, memberId));
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: isSelf ? 'group.member.leave' : 'group.member.remove', resourceType: 'group_member', resourceId: memberId }, tx);
  });
  res.status(204).end();
}));

groupsRouter.post('/:groupId/transfer-owner', requireAuth, validateBody(transferOwnershipSchema), asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const body = transferOwnershipSchema.parse(req.body);
  if (body.newOwnerUserId === req.auth!.userId) throw unprocessable('Ya eres el propietario del grupo', 'OWNER_UNCHANGED');
  const now = new Date();
  await db.transaction(async tx => {
    const group = (await tx.select({ id: groups.id }).from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const actor = await assertGroupPermissionTx(tx, groupId, req.auth!.userId, 'members:manage');
    if (actor.role !== 'owner') throw forbidden('Solo el propietario puede transferir la propiedad');
    const target = (await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, body.newOwnerUserId), eq(groupMembers.status, 'active'))).limit(1).for('update'))[0];
    if (!target) throw notFound('El nuevo propietario debe ser miembro activo del grupo');
    await tx.update(groupMembers).set({ role: 'admin' }).where(eq(groupMembers.id, actor.id));
    await tx.update(groupMembers).set({ role: 'owner' }).where(eq(groupMembers.id, target.id));
    await tx.update(groups).set({ createdBy: target.userId, updatedAt: now }).where(eq(groups.id, groupId));
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'group.owner.transfer', resourceType: 'group', resourceId: groupId, metadata: { newOwnerUserId: target.userId } }, tx);
  });
  res.json({ groupId, previousOwnerUserId: req.auth!.userId, ownerUserId: body.newOwnerUserId, transferredAt: now.toISOString() });
}));

groupsRouter.get('/:groupId/permissions', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const member = await getMembership(groupId, req.auth!.userId);
  if (member.role !== 'owner') await assertGroupPermission(groupId, req.auth!.userId, 'permissions:manage');
  res.json({ groupId, roles: { admin: await permissionsFor(groupId, 'admin'), member: await permissionsFor(groupId, 'member') } });
}));

groupsRouter.patch('/:groupId/permissions', requireAuth, validateBody(updatePermissionsSchema), asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const body = updatePermissionsSchema.parse(req.body);
  const permissions = [...new Set(body.permissions)];
  if (permissions.includes('permissions:manage') && body.role !== 'admin') throw unprocessable('Solo el rol admin puede recibir permissions:manage', 'INVALID_PERMISSION');
  await db.transaction(async tx => {
    const group = (await tx.select({ id: groups.id }).from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    const actor = await assertGroupPermissionTx(tx, groupId, req.auth!.userId, 'permissions:manage');
    if (actor.role !== 'owner') throw forbidden('Solo el propietario puede modificar la matriz de permisos');
    const old = (await tx.select().from(groupRolePermissions).where(and(eq(groupRolePermissions.groupId, groupId), eq(groupRolePermissions.role, body.role))).limit(1).for('update'))[0];
    if (old) await tx.update(groupRolePermissions).set({ permissions, updatedBy: req.auth!.userId, updatedAt: new Date() }).where(eq(groupRolePermissions.id, old.id));
    else await tx.insert(groupRolePermissions).values({ id: randomUUID(), groupId, role: body.role, permissions, updatedBy: req.auth!.userId, updatedAt: new Date() });
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'group.permissions.update', resourceType: 'group', resourceId: groupId, metadata: { role: body.role, permissionCount: permissions.length } }, tx);
  });
  res.json({ groupId, role: body.role, permissions });
}));
