import { randomUUID } from 'node:crypto';
import {
  bigint, boolean, date, datetime, decimal, index, int, json, mysqlTable,
  primaryKey, text, uniqueIndex, varchar,
} from 'drizzle-orm/mysql-core';
import type { GroupPermission, MemberRole } from '@pazito/contracts';

const id = (name = 'id') => varchar(name, { length: 36 }).$defaultFn(() => randomUUID());
const createdAt = () => datetime('created_at', { mode: 'date', fsp: 3 }).notNull().$defaultFn(() => new Date());
const updatedAt = () => datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().$defaultFn(() => new Date());

export const users = mysqlTable('users', {
  id: id().primaryKey(), email: varchar('email', { length: 254 }).notNull(),
  name: varchar('name', { length: 80 }).notNull(), passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 2048 }), locale: varchar('locale', { length: 20 }).notNull().default('es-CO'),
  timezone: varchar('timezone', { length: 80 }).notNull().default('America/Bogota'),
  emailVerifiedAt: datetime('email_verified_at', { mode: 'date', fsp: 3 }),
  deactivatedAt: datetime('deactivated_at', { mode: 'date', fsp: 3 }), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [uniqueIndex('uq_users_email').on(t.email), index('idx_users_created_at').on(t.createdAt)]);

export const sessions = mysqlTable('sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(), userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(), createdAt: createdAt(), lastSeenAt: datetime('last_seen_at', { mode: 'date', fsp: 3 }).notNull().$defaultFn(() => new Date()),
  userAgent: varchar('user_agent', { length: 512 }), ipHash: varchar('ip_hash', { length: 64 }),
}, (t) => [index('idx_sessions_user').on(t.userId), index('idx_sessions_expiry').on(t.expiresAt)]);

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(), userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(), usedAt: datetime('used_at', { mode: 'date', fsp: 3 }), createdAt: createdAt(),
}, (t) => [index('idx_password_reset_user').on(t.userId), index('idx_password_reset_expiry').on(t.expiresAt)]);

export const groups = mysqlTable('groups', {
  id: id().primaryKey(), name: varchar('name', { length: 100 }).notNull(), description: text('description'), avatarUrl: varchar('avatar_url', { length: 2048 }),
  currency: varchar('currency', { length: 3 }).notNull().default('COP'), locale: varchar('locale', { length: 20 }).notNull().default('es-CO'),
  timezone: varchar('timezone', { length: 80 }).notNull().default('America/Bogota'), createdBy: varchar('created_by', { length: 36 }).notNull().references(() => users.id),
  archivedAt: datetime('archived_at', { mode: 'date', fsp: 3 }), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('idx_groups_creator').on(t.createdBy), index('idx_groups_archived').on(t.archivedAt)]);

export const groupMembers = mysqlTable('group_members', {
  id: id().primaryKey(), groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  role: varchar('role', { length: 12 }).$type<MemberRole>().notNull().default('member'),
  status: varchar('status', { length: 12 }).notNull().default('active'), joinedAt: createdAt(), leftAt: datetime('left_at', { mode: 'date', fsp: 3 }),
}, (t) => [uniqueIndex('uq_group_members_group_user').on(t.groupId, t.userId), index('idx_group_members_user_status').on(t.userId, t.status), index('idx_group_members_group_status').on(t.groupId, t.status)]);

export const groupRolePermissions = mysqlTable('group_role_permissions', {
  id: id().primaryKey(), groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 12 }).$type<Exclude<MemberRole, 'owner'>>().notNull(),
  permissions: json('permissions').$type<GroupPermission[]>().notNull(), updatedAt: updatedAt(), updatedBy: varchar('updated_by', { length: 36 }).notNull().references(() => users.id),
}, (t) => [uniqueIndex('uq_group_role_permissions').on(t.groupId, t.role)]);

export const groupInvitations = mysqlTable('group_invitations', {
  id: id().primaryKey(), groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id),
  invitedBy: varchar('invited_by', { length: 36 }).notNull().references(() => users.id), invitedEmail: varchar('invited_email', { length: 254 }),
  role: varchar('role', { length: 12 }).$type<Exclude<MemberRole, 'owner'>>().notNull().default('member'), tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  status: varchar('status', { length: 12 }).notNull().default('pending'), expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
  acceptedBy: varchar('accepted_by', { length: 36 }).references(() => users.id), acceptedAt: datetime('accepted_at', { mode: 'date', fsp: 3 }), revokedAt: datetime('revoked_at', { mode: 'date', fsp: 3 }), createdAt: createdAt(),
}, (t) => [uniqueIndex('uq_group_invitation_token').on(t.tokenHash), index('idx_invitation_group_status').on(t.groupId, t.status), index('idx_invitation_expiry').on(t.expiresAt)]);

export const categories = mysqlTable('categories', {
  id: id().primaryKey(), groupId: varchar('group_id', { length: 36 }).references(() => groups.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 60 }).notNull(), icon: varchar('icon', { length: 40 }).notNull().default('circle'), color: varchar('color', { length: 7 }).notNull().default('#64748b'),
  isDefault: boolean('is_default').notNull().default(false), createdBy: varchar('created_by', { length: 36 }).references(() => users.id), createdAt: createdAt(),
}, (t) => [index('idx_categories_group').on(t.groupId), uniqueIndex('uq_categories_group_name').on(t.groupId, t.name)]);

export const expenses = mysqlTable('expenses', {
  id: id().primaryKey(), groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id),
  title: varchar('title', { length: 160 }).notNull(), description: text('description'), amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(), settlementAmountMinor: bigint('settlement_amount_minor', { mode: 'bigint' }).notNull(),
  settlementCurrency: varchar('settlement_currency', { length: 3 }).notNull(), fxRate: decimal('fx_rate', { precision: 24, scale: 12, mode: 'string' }),
  fxSource: varchar('fx_source', { length: 80 }), fxAsOf: datetime('fx_as_of', { mode: 'date', fsp: 3 }),
  paidBy: varchar('paid_by', { length: 36 }).notNull().references(() => users.id), createdBy: varchar('created_by', { length: 36 }).notNull().references(() => users.id),
  splitType: varchar('split_type', { length: 12 }).notNull(), categoryId: varchar('category_id', { length: 36 }).references(() => categories.id),
  date: date('expense_date', { mode: 'string' }).notNull(), archivedAt: datetime('archived_at', { mode: 'date', fsp: 3 }), version: int('version').notNull().default(1),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('idx_expenses_group_date').on(t.groupId, t.date), index('idx_expenses_paid_by').on(t.paidBy), index('idx_expenses_category').on(t.categoryId), index('idx_expenses_created_by').on(t.createdBy)]);

export const expenseShares = mysqlTable('expense_shares', {
  id: id().primaryKey(), expenseId: varchar('expense_id', { length: 36 }).notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id), amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(), originalAmountMinor: bigint('original_amount_minor', { mode: 'bigint' }).notNull(),
  percentageBasisPoints: int('percentage_basis_points'), createdAt: createdAt(),
}, (t) => [uniqueIndex('uq_expense_share_expense_user').on(t.expenseId, t.userId), index('idx_expense_share_user').on(t.userId), index('idx_expense_share_expense').on(t.expenseId)]);

export const settlements = mysqlTable('settlements', {
  id: id().primaryKey(), groupId: varchar('group_id', { length: 36 }).notNull().references(() => groups.id),
  fromUserId: varchar('from_user_id', { length: 36 }).notNull().references(() => users.id), toUserId: varchar('to_user_id', { length: 36 }).notNull().references(() => users.id),
  amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(), currency: varchar('currency', { length: 3 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('declared'), declaredAt: datetime('declared_at', { mode: 'date', fsp: 3 }).notNull(),
  confirmedAt: datetime('confirmed_at', { mode: 'date', fsp: 3 }), disputedAt: datetime('disputed_at', { mode: 'date', fsp: 3 }), disputeReason: varchar('dispute_reason', { length: 500 }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index('idx_settlements_group_status').on(t.groupId, t.status), index('idx_settlements_from').on(t.fromUserId), index('idx_settlements_to').on(t.toUserId)]);

export const settlementEvents = mysqlTable('settlement_events', {
  id: id().primaryKey(), settlementId: varchar('settlement_id', { length: 36 }).notNull().references(() => settlements.id, { onDelete: 'cascade' }),
  actorUserId: varchar('actor_user_id', { length: 36 }).notNull().references(() => users.id), event: varchar('event', { length: 24 }).notNull(),
  reason: varchar('reason', { length: 500 }), createdAt: createdAt(),
}, (t) => [index('idx_settlement_events_settlement').on(t.settlementId)]);

export const idempotencyKeys = mysqlTable('idempotency_keys', {
  id: id().primaryKey(), userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  operation: varchar('operation', { length: 120 }).notNull(), key: varchar('key', { length: 100 }).notNull(), payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
  responseJson: json('response_json').$type<unknown>(), statusCode: int('status_code').notNull().default(200), createdAt: createdAt(),
}, (t) => [uniqueIndex('uq_idempotency_user_operation_key').on(t.userId, t.operation, t.key), index('idx_idempotency_created').on(t.createdAt)]);

export const auditEvents = mysqlTable('audit_events', {
  id: id().primaryKey(), requestId: varchar('request_id', { length: 64 }), actorUserId: varchar('actor_user_id', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), resourceType: varchar('resource_type', { length: 60 }).notNull(), resourceId: varchar('resource_id', { length: 36 }),
  outcome: varchar('outcome', { length: 16 }).notNull().default('success'), metadata: json('metadata').$type<Record<string, unknown>>(), createdAt: createdAt(),
}, (t) => [index('idx_audit_actor_time').on(t.actorUserId, t.createdAt), index('idx_audit_resource').on(t.resourceType, t.resourceId), index('idx_audit_request').on(t.requestId)]);

export const receipts = mysqlTable('receipts', {
  id: id().primaryKey(), expenseId: varchar('expense_id', { length: 36 }).notNull().references(() => expenses.id),
  uploadedBy: varchar('uploaded_by', { length: 36 }).notNull().references(() => users.id), originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 80 }).notNull(), sizeBytes: int('size_bytes').notNull(), sha256: varchar('sha256', { length: 64 }).notNull(), storageKey: varchar('storage_key', { length: 100 }).notNull(), createdAt: createdAt(),
}, (t) => [index('idx_receipts_expense').on(t.expenseId), index('idx_receipts_uploader').on(t.uploadedBy), uniqueIndex('uq_receipts_storage_key').on(t.storageKey)]);

export const fxRateCache = mysqlTable('fx_rate_cache', {
  id: id().primaryKey(), baseCurrency: varchar('base_currency', { length: 3 }).notNull(), quoteCurrency: varchar('quote_currency', { length: 3 }).notNull(),
  rate: decimal('rate', { precision: 24, scale: 12, mode: 'string' }).notNull(), source: varchar('source', { length: 80 }).notNull(), asOf: datetime('as_of', { mode: 'date', fsp: 3 }).notNull(), expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(), createdAt: createdAt(),
}, (t) => [uniqueIndex('uq_fx_pair').on(t.baseCurrency, t.quoteCurrency), index('idx_fx_expiry').on(t.expiresAt)]);

export type DatabaseSchema = typeof users | typeof sessions | typeof passwordResetTokens | typeof groups | typeof groupMembers | typeof groupRolePermissions | typeof groupInvitations | typeof categories | typeof expenses | typeof expenseShares | typeof settlements | typeof settlementEvents | typeof idempotencyKeys | typeof auditEvents | typeof receipts | typeof fxRateCache;
