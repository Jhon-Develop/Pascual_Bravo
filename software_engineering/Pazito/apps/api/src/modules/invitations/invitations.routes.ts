import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { acceptInvitationSchema, createInvitationSchema } from '@pazito/contracts';
import { db } from '../../infrastructure/database/client.js';
import { groupInvitations, groupMembers, groups, users } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { validateBody } from '../../shared/http/validate.js';
import { conflict, forbidden, notFound, unprocessable } from '../../shared/errors/app-error.js';
import { randomToken, sha256 } from '../../shared/security/crypto.js';
import { assertGroupPermission, assertGroupPermissionTx, getMembership } from '../groups/permissions.service.js';
import { withIdempotency } from '../../infrastructure/database/idempotency.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';
import { env } from '../../config/env.js';
import { emailService } from '../../infrastructure/mailer/email.service.js';

export const groupInvitationsRouter = Router();
export const invitationsRouter = Router();

function publicInvitation(row: typeof groupInvitations.$inferSelect, groupName: string, inviterName: string, invitationUrl?: string) {
  return { id: row.id, groupId: row.groupId, groupName, invitedBy: row.invitedBy, invitedByName: inviterName, email: row.invitedEmail, role: row.role,
    status: row.status, expiresAt: row.expiresAt.toISOString(), createdAt: row.createdAt.toISOString(), ...(invitationUrl ? { invitationUrl } : {}) };
}

groupInvitationsRouter.post('/:groupId/invitations', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const body = createInvitationSchema.parse(req.body);
  const actorMember = await assertGroupPermission(groupId, req.auth!.userId, 'invitations:manage');
  if (body.role === 'admin' && actorMember.role !== 'owner') throw forbidden('Solo el propietario puede invitar a un administrador');
  const group = (await db.select().from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1))[0]; if (!group) throw notFound('Grupo no encontrado');
  if (body.email) {
    const existingUser = (await db.select({ id: users.id }).from(users).where(eq(users.email, body.email.toLocaleLowerCase('en-US'))).limit(1))[0];
    if (existingUser) {
      const membership = (await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, existingUser.id), eq(groupMembers.status, 'active'))).limit(1))[0];
      if (membership) throw conflict('Esta persona ya pertenece al grupo', 'ALREADY_GROUP_MEMBER');
    }
  }
  const rawToken = randomToken(32); const expiresAt = new Date(Date.now() + body.expiresInDays * 86_400_000); const id = randomUUID();
  const { result, replayed } = await withIdempotency(req.auth!.userId, `POST:/groups/${groupId}/invitations`, req.header('Idempotency-Key'), body, async tx => {
    const lockedGroup = (await tx.select().from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!lockedGroup) throw notFound('Grupo no encontrado');
    const actingMember = await assertGroupPermissionTx(tx, groupId, req.auth!.userId, 'invitations:manage');
    if (body.role === 'admin' && actingMember.role !== 'owner') throw forbidden('Solo el propietario puede invitar a un administrador');
    if (body.email) {
      const existingUser = (await tx.select({ id: users.id }).from(users).where(eq(users.email, body.email.toLocaleLowerCase('en-US'))).limit(1))[0];
      if (existingUser) {
        const membership = (await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, existingUser.id), eq(groupMembers.status, 'active'))).limit(1))[0];
        if (membership) throw conflict('Esta persona ya pertenece al grupo', 'ALREADY_GROUP_MEMBER');
      }
    }
    await tx.insert(groupInvitations).values({ id, groupId, invitedBy: req.auth!.userId, invitedEmail: body.email?.toLocaleLowerCase('en-US') ?? null, role: body.role, tokenHash: sha256(rawToken), status: 'pending', expiresAt });
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'invitation.create', resourceType: 'invitation', resourceId: id, metadata: { groupId, role: body.role, emailInvite: Boolean(body.email) } }, tx);
    return { id, groupId, groupName: lockedGroup.name, invitedBy: req.auth!.userId, invitedByName: req.auth!.user.name, email: body.email ?? null, role: body.role, status: 'pending', expiresAt: expiresAt.toISOString(), createdAt: new Date().toISOString(), invitationUrl: `${env.frontendOrigins[0] ?? 'http://localhost:4321'}/app/#/invitations/accept?token=${encodeURIComponent(rawToken)}` };
  });
  // Replayed requests return the first result/token. A different payload under the same key is rejected by idempotency.
  if (body.email && !replayed) await emailService.sendGroupInvitation(body.email, group.name, result.invitationUrl, req.auth!.user.name).catch(() => undefined);
  res.setHeader('Idempotency-Replayed', String(replayed)); res.status(replayed ? 200 : 201).json(result);
}));

groupInvitationsRouter.get('/:groupId/invitations', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); await assertGroupPermission(groupId, req.auth!.userId, 'invitations:manage');
  const rows = await db.select({ invitation: groupInvitations, groupName: groups.name, inviterName: users.name }).from(groupInvitations)
    .innerJoin(groups, eq(groups.id, groupInvitations.groupId)).innerJoin(users, eq(users.id, groupInvitations.invitedBy)).where(eq(groupInvitations.groupId, groupId)).orderBy(groupInvitations.createdAt);
  res.json(rows.map(({ invitation, groupName, inviterName }) => publicInvitation(invitation, groupName, inviterName)));
}));

groupInvitationsRouter.delete('/:groupId/invitations/:invitationId', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); const invitationId = String(req.params.invitationId); await assertGroupPermission(groupId, req.auth!.userId, 'invitations:manage');
  const invitation = (await db.select().from(groupInvitations).where(and(eq(groupInvitations.id, invitationId), eq(groupInvitations.groupId, groupId))).limit(1))[0];
  if (!invitation) throw notFound('Invitación no encontrada');
  if (invitation.status !== 'pending') throw conflict('Solo pueden revocarse invitaciones pendientes', 'INVITATION_NOT_PENDING');
  await db.update(groupInvitations).set({ status: 'revoked', revokedAt: new Date() }).where(eq(groupInvitations.id, invitationId));
  await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'invitation.revoke', resourceType: 'invitation', resourceId: invitationId, metadata: { groupId } });
  res.status(204).end();
}));

invitationsRouter.post('/accept', requireAuth, validateBody(acceptInvitationSchema), asyncHandler(async (req, res) => {
  const body = acceptInvitationSchema.parse(req.body); const hash = sha256(body.token);
  const invitation = (await db.select().from(groupInvitations).where(eq(groupInvitations.tokenHash, hash)).limit(1))[0];
  if (!invitation) throw notFound('La invitación no es válida');
  if (invitation.status !== 'pending') throw conflict('La invitación ya fue utilizada o revocada', 'INVITATION_NOT_PENDING');
  if (invitation.expiresAt <= new Date()) { await db.update(groupInvitations).set({ status: 'expired' }).where(eq(groupInvitations.id, invitation.id)); throw unprocessable('La invitación ha caducado', 'INVITATION_EXPIRED'); }
  const user = req.auth!.user;
  if (invitation.invitedEmail && invitation.invitedEmail.toLocaleLowerCase('en-US') !== user.email.toLocaleLowerCase('en-US')) throw forbidden('Esta invitación se envió a otra dirección de correo');
  const group = (await db.select().from(groups).where(and(eq(groups.id, invitation.groupId), isNull(groups.archivedAt))).limit(1))[0]; if (!group) throw notFound('El grupo ya no está disponible');
  const now = new Date();
  await db.transaction(async tx => {
    const lockedGroup = (await tx.select().from(groups).where(eq(groups.id, invitation.groupId)).limit(1).for('update'))[0];
    if (!lockedGroup || lockedGroup.archivedAt) throw notFound('El grupo ya no está disponible');
    // Lock and claim the invitation before making membership changes. This prevents
    // two accounts racing to redeem the same one-time invitation.
    const locked = (await tx.select().from(groupInvitations).where(eq(groupInvitations.id, invitation.id)).limit(1).for('update'))[0];
    if (!locked || locked.status !== 'pending') throw conflict('La invitación ya fue utilizada o revocada', 'INVITATION_NOT_PENDING');
    if (locked.expiresAt <= now) throw unprocessable('La invitación ha caducado', 'INVITATION_EXPIRED');
    const membership = (await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id))).limit(1))[0];
    await tx.update(groupInvitations).set({ status: 'accepted', acceptedBy: user.id, acceptedAt: now }).where(eq(groupInvitations.id, invitation.id));
    if (membership) {
      await tx.update(groupMembers).set({ role: invitation.role, status: 'active', leftAt: null, joinedAt: now }).where(eq(groupMembers.id, membership.id));
    } else {
      await tx.insert(groupMembers).values({ id: randomUUID(), groupId: group.id, userId: user.id, role: invitation.role, status: 'active', joinedAt: now });
    }
    await auditEvent({ requestId: req.requestId, actorUserId: user.id, action: 'invitation.accept', resourceType: 'invitation', resourceId: invitation.id, metadata: { groupId: group.id } }, tx);
  });
  const memberRows = await db.select({ id: groupMembers.id }).from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.status, 'active')));
  res.json({ id: group.id, name: group.name, description: group.description, currency: group.currency, createdBy: group.createdBy, createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString(), memberCount: memberRows.length, userRole: invitation.role });
}));
