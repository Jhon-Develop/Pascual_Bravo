import { and, eq } from 'drizzle-orm';
import type { GroupPermission, MemberRole } from '@pazito/contracts';
import { db, type DbTransaction } from '../../infrastructure/database/client.js';
import { groupMembers, groupRolePermissions } from '../../infrastructure/database/schema.js';
import { forbidden, notFound } from '../../shared/errors/app-error.js';

export const ALL_PERMISSIONS: GroupPermission[] = [
  'group:read', 'group:update', 'group:archive', 'members:read', 'members:manage', 'invitations:manage',
  'expenses:create', 'expenses:update_own', 'expenses:update_any', 'expenses:delete_own', 'expenses:delete_any',
  'settlements:create', 'settlements:confirm', 'settlements:dispute', 'receipts:manage', 'reports:export',
  'permissions:manage', 'categories:manage',
];
export const DEFAULT_PERMISSIONS: Record<Exclude<MemberRole, 'owner'>, GroupPermission[]> = {
  admin: ['group:read', 'group:update', 'members:read', 'members:manage', 'invitations:manage', 'expenses:create', 'expenses:update_any', 'expenses:delete_any', 'settlements:create', 'settlements:confirm', 'settlements:dispute', 'receipts:manage', 'reports:export', 'categories:manage'],
  member: ['group:read', 'members:read', 'expenses:create', 'expenses:update_own', 'expenses:delete_own', 'settlements:create', 'settlements:confirm', 'settlements:dispute', 'receipts:manage'],
};

export async function getMembership(groupId: string, userId: string) {
  const rows = await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, 'active'))).limit(1);
  if (!rows[0]) throw notFound('No se encontró el grupo');
  return rows[0];
}
export async function assertGroupPermission(groupId: string, userId: string, permission: GroupPermission) {
  const member = await getMembership(groupId, userId);
  if (member.role === 'owner') return member;
  const rows = await db.select().from(groupRolePermissions).where(and(eq(groupRolePermissions.groupId, groupId), eq(groupRolePermissions.role, member.role))).limit(1);
  const allowed = rows[0]?.permissions ?? DEFAULT_PERMISSIONS[member.role as Exclude<MemberRole, 'owner'>] ?? [];
  if (!allowed.includes(permission)) throw forbidden(`Tu rol no tiene el permiso ${permission}`);
  return member;
}
export async function permissionsFor(groupId: string, role: Exclude<MemberRole, 'owner'>) {
  const rows = await db.select().from(groupRolePermissions).where(and(eq(groupRolePermissions.groupId, groupId), eq(groupRolePermissions.role, role))).limit(1);
  return rows[0]?.permissions ?? DEFAULT_PERMISSIONS[role];
}


/** Same authorization check against the transaction being used for the write. */
export async function assertGroupPermissionTx(tx: DbTransaction, groupId: string, userId: string, permission: GroupPermission) {
  const rows = await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, 'active'))).limit(1);
  const member = rows[0];
  if (!member) throw notFound('No se encontró el grupo');
  if (member.role === 'owner') return member;
  const roleRows = await tx.select().from(groupRolePermissions).where(and(eq(groupRolePermissions.groupId, groupId), eq(groupRolePermissions.role, member.role))).limit(1);
  const allowed = roleRows[0]?.permissions ?? DEFAULT_PERMISSIONS[member.role as Exclude<MemberRole, 'owner'>] ?? [];
  if (!allowed.includes(permission)) throw forbidden(`Tu rol no tiene el permiso ${permission}`);
  return member;
}
