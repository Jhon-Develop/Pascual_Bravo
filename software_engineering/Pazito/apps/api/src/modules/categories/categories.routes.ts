import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { createCategorySchema, uuidSchema } from '@pazito/contracts';
import { db } from '../../infrastructure/database/client.js';
import { categories, expenses, groupMembers } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { assertGroupPermission } from '../groups/permissions.service.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';
import { conflict, notFound, unprocessable } from '../../shared/errors/app-error.js';

export const categoriesRouter = Router();
categoriesRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
  if (groupId) await assertGroupPermission(groupId, req.auth!.userId, 'group:read');
  const memberships = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active')));
  const groupIds = memberships.map(m => m.groupId).filter(id => !groupId || id === groupId);
  const whereCategories = groupId
    ? or(isNull(categories.groupId), eq(categories.groupId, groupId))
    : groupIds.length ? or(isNull(categories.groupId), inArray(categories.groupId, groupIds)) : isNull(categories.groupId);
  const rows = await db.select().from(categories).where(whereCategories);
  res.json(rows.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, isDefault: c.isDefault, groupId: c.groupId })));
}));

categoriesRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = createCategorySchema.parse(req.body); const groupId = typeof req.body.groupId === 'string' ? uuidSchema.parse(req.body.groupId) : undefined;
  if (!groupId) throw unprocessable('Las categorías personalizadas deben pertenecer a un grupo', 'GROUP_REQUIRED');
  await assertGroupPermission(groupId, req.auth!.userId, 'categories:manage');
  const duplicate = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.groupId, groupId), eq(categories.name, body.name))).limit(1);
  if (duplicate[0]) throw conflict('Ya existe una categoría con ese nombre en el grupo', 'CATEGORY_EXISTS');
  const id = randomUUID(); await db.insert(categories).values({ id, groupId, name: body.name, icon: body.icon, color: body.color, isDefault: false, createdBy: req.auth!.userId });
  await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'category.create', resourceType: 'category', resourceId: id, metadata: { groupId } });
  res.status(201).json({ id, groupId, name: body.name, icon: body.icon, color: body.color, isDefault: false });
}));

categoriesRouter.delete('/:categoryId', requireAuth, asyncHandler(async (req, res) => {
  const id = uuidSchema.parse(req.params.categoryId); const category = (await db.select().from(categories).where(eq(categories.id, id)).limit(1))[0];
  if (!category) throw notFound('Categoría no encontrada'); if (!category.groupId) throw conflict('No se pueden eliminar categorías predeterminadas', 'DEFAULT_CATEGORY_IMMUTABLE');
  await assertGroupPermission(category.groupId, req.auth!.userId, 'categories:manage');
  const inUse = (await db.select({ id: expenses.id }).from(expenses).where(and(eq(expenses.categoryId, id), isNull(expenses.archivedAt))).limit(1))[0];
  if (inUse) throw conflict('La categoría está siendo usada por uno o más gastos', 'CATEGORY_IN_USE');
  await db.delete(categories).where(eq(categories.id, id));
  await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'category.delete', resourceType: 'category', resourceId: id, metadata: { groupId: category.groupId } });
  res.status(204).end();
}));
