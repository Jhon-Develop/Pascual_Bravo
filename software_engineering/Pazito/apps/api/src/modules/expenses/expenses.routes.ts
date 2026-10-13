import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { and, asc, count, desc, eq, inArray, isNull, like, lte, gte, or, ne } from 'drizzle-orm';
import { createExpenseSchema, paginationSchema, updateExpenseSchema } from '@pazito/contracts';
import { db } from '../../infrastructure/database/client.js';
import { categories, expenses, expenseShares, groupMembers, groups, settlements, users } from '../../infrastructure/database/schema.js';
import { findIdempotentReplay, withIdempotency } from '../../infrastructure/database/idempotency.js';
import { getFxQuote } from '../../infrastructure/fx/fx.service.js';
import { convertMinorAmount, convertSharesExact, assertPositiveSafeMinor, toSafeAmount, isValidCurrency } from '../../shared/validation/currency.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { validateBody } from '../../shared/http/validate.js';
import { assertGroupPermission, assertGroupPermissionTx, getMembership } from '../groups/permissions.service.js';
import { calculateShares } from './split.service.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../shared/errors/app-error.js';
import type { DbTransaction } from '../../infrastructure/database/client.js';

export const expensesRouter = Router();
const iso = (value: Date | null | undefined) => value ? value.toISOString() : null;
function asDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw badRequest('Fecha inválida; usa YYYY-MM-DD', 'INVALID_DATE');
  return value;
}
function safeNumber(value: bigint) { return toSafeAmount(value); }

async function loadExpenseDTO(expenseId: string, userId: string) {
  const rows = await db.select({ expense: expenses, payer: users, category: categories }).from(expenses)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, expenses.groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, 'active')))
    .innerJoin(users, eq(users.id, expenses.paidBy)).leftJoin(categories, eq(categories.id, expenses.categoryId))
    .where(and(eq(expenses.id, expenseId), isNull(expenses.archivedAt))).limit(1);
  const row = rows[0]; if (!row) throw notFound('Gasto no encontrado');
  const shares = await db.select({ share: expenseShares, user: users }).from(expenseShares).innerJoin(users, eq(users.id, expenseShares.userId)).where(eq(expenseShares.expenseId, expenseId)).orderBy(asc(expenseShares.userId));
  return {
    id: row.expense.id, groupId: row.expense.groupId, title: row.expense.title, description: row.expense.description,
    amountMinor: safeNumber(row.expense.amountMinor), currency: row.expense.currency,
    settlementAmountMinor: safeNumber(row.expense.settlementAmountMinor), settlementCurrency: row.expense.settlementCurrency,
    fxRate: row.expense.fxRate, fxSource: row.expense.fxSource, fxAsOf: iso(row.expense.fxAsOf),
    paidBy: row.expense.paidBy, paidByName: row.payer.name, paidByAvatar: row.payer.avatarUrl,
    splitType: row.expense.splitType, splits: shares.map(({ share }) => ({ userId: share.userId, amountMinor: safeNumber(share.originalAmountMinor), settlementAmountMinor: safeNumber(share.amountMinor), ...(share.percentageBasisPoints !== null ? { percentage: share.percentageBasisPoints / 100 } : {}) })),
    categoryId: row.expense.categoryId, categoryName: row.category?.name ?? null, categoryColor: row.category?.color ?? null,
    date: row.expense.date, createdAt: row.expense.createdAt.toISOString(), updatedAt: row.expense.updatedAt.toISOString(), archivedAt: iso(row.expense.archivedAt),
    settlementStatus: 'pending' as const, version: row.expense.version,
  };
}

async function quoteForExpense(sourceCurrency: string, groupCurrency: string, amountMinor: bigint, manualRate?: string) {
  if (!isValidCurrency(sourceCurrency) || !isValidCurrency(groupCurrency)) throw badRequest('Código de moneda ISO 4217 no soportado', 'INVALID_CURRENCY');
  if (sourceCurrency === groupCurrency) return { settlementAmountMinor: amountMinor, fxRate: null as string | null, fxSource: 'same-currency', fxAsOf: new Date() };
  const quote = await getFxQuote(sourceCurrency, groupCurrency, manualRate);
  const converted = convertMinorAmount(amountMinor, sourceCurrency, groupCurrency, quote.rate);
  if (converted <= 0n) throw unprocessable('El importe convertido es cero; revisa el importe y la tasa de cambio', 'FX_AMOUNT_ROUNDS_TO_ZERO');
  return { settlementAmountMinor: converted, fxRate: quote.rate, fxSource: quote.source, fxAsOf: quote.asOf };
}
async function insertShares(
  tx: DbTransaction, expenseId: string, splitType: 'equal' | 'custom' | 'percentage', originalAmountMinor: bigint,
  settlementAmountMinor: bigint, sourceCurrency: string, targetCurrency: string, rate: string, splits: { userId: string; amountMinor?: number; percentage?: number }[],
) {
  const originalShares = calculateShares(originalAmountMinor, splitType, splits);
  const finalShares = convertSharesExact(originalShares, sourceCurrency, targetCurrency, rate, settlementAmountMinor);
  for (const share of finalShares) await tx.insert(expenseShares).values({ id: randomUUID(), expenseId, userId: share.userId, amountMinor: share.amountMinor, originalAmountMinor: share.originalAmountMinor, percentageBasisPoints: share.percentageBasisPoints });
  return finalShares;
}

expensesRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const query = req.query as Record<string, unknown>; const { page, limit } = paginationSchema.parse(query);
  const groupId = typeof query.groupId === 'string' ? query.groupId : undefined;
  const categoryId = typeof query.categoryId === 'string' ? query.categoryId : undefined;
  const paidBy = typeof query.paidBy === 'string' ? query.paidBy : undefined;
  const dateFrom = typeof query.dateFrom === 'string' ? asDateOnly(query.dateFrom) : undefined;
  const dateTo = typeof query.dateTo === 'string' ? asDateOnly(query.dateTo) : undefined;
  const amountMin = query.amountMin === undefined ? undefined : Number(query.amountMin);
  const amountMax = query.amountMax === undefined ? undefined : Number(query.amountMax);
  if ((amountMin !== undefined || amountMax !== undefined) && !groupId) throw badRequest('Para filtrar por importe debes seleccionar un grupo, ya que cada grupo puede tener una moneda de liquidación diferente', 'GROUP_REQUIRED_FOR_AMOUNT_FILTER');
  if (amountMin !== undefined && (!Number.isSafeInteger(amountMin) || amountMin < 0)) throw badRequest('amountMin debe ser un entero no negativo en unidades menores', 'INVALID_AMOUNT_FILTER');
  if (amountMax !== undefined && (!Number.isSafeInteger(amountMax) || amountMax < 0)) throw badRequest('amountMax debe ser un entero no negativo en unidades menores', 'INVALID_AMOUNT_FILTER');
  if (dateFrom && dateTo && dateFrom > dateTo) throw badRequest('dateFrom debe ser anterior o igual a dateTo', 'INVALID_DATE_RANGE');
  const memberships = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active')));
  const groupIds = memberships.map(m => m.groupId).filter(id => !groupId || groupId === id);
  if (groupId && !groupIds.length) throw notFound('Grupo no encontrado');
  if (!groupIds.length) return res.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
  const whereParts = [inArray(expenses.groupId, groupIds), isNull(expenses.archivedAt)];
  if (categoryId) whereParts.push(eq(expenses.categoryId, categoryId));
  if (paidBy) whereParts.push(eq(expenses.paidBy, paidBy));
  if (dateFrom) whereParts.push(gte(expenses.date, dateFrom));
  if (dateTo) whereParts.push(lte(expenses.date, dateTo));
  if (amountMin !== undefined) whereParts.push(gte(expenses.settlementAmountMinor, BigInt(amountMin)));
  if (amountMax !== undefined) whereParts.push(lte(expenses.settlementAmountMinor, BigInt(amountMax)));
  if (typeof query.search === 'string' && query.search.trim()) {
    const term = query.search.trim().replace(/[\\%_]/g, '\\$&');
    whereParts.push(or(like(expenses.title, `%${term}%`), like(expenses.description, `%${term}%`))!);
  }
  const whereClause = and(...whereParts)!;
  const rows = await db.select({ id: expenses.id }).from(expenses).where(whereClause).orderBy(desc(expenses.date), desc(expenses.createdAt)).limit(limit).offset((page - 1) * limit);
  const totalRows = await db.select({ total: count() }).from(expenses).where(whereClause); const total = Number(totalRows[0]?.total ?? 0);
  const data = await Promise.all(rows.map(row => loadExpenseDTO(row.id, req.auth!.userId)));
  res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));

export async function createExpenseCommand(userId: string, requestId: string | undefined, rawBody: unknown, idempotencyKey: string | undefined) {
  const body = createExpenseSchema.parse(rawBody); asDateOnly(body.date);
  await assertGroupPermission(body.groupId, userId, 'expenses:create');
  const replay = await findIdempotentReplay<{ id: string; groupId: string; createdAt: string }>(userId, 'POST:/expenses', idempotencyKey, body);
  if (replay) return replay;

  // Resolve network-dependent FX and ordinary reads before opening the write transaction.
  // This avoids borrowing a second pooled connection while holding a transaction open.
  const groupBefore = (await db.select().from(groups).where(and(eq(groups.id, body.groupId), isNull(groups.archivedAt))).limit(1))[0];
  if (!groupBefore) throw notFound('Grupo no encontrado');
  const sourceCurrency = body.currency ?? groupBefore.currency;
  const originalAmount = assertPositiveSafeMinor(body.amountMinor);
  const quote = await quoteForExpense(sourceCurrency, groupBefore.currency, originalAmount, body.fxRate);
  if (quote.settlementAmountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw unprocessable('El importe convertido excede el rango admitido por la API', 'AMOUNT_TOO_LARGE');
  const expectedUsers = new Set([body.paidBy, ...body.splits.map(split => split.userId)]);
  const membersBefore = await db.select({ userId: groupMembers.userId }).from(groupMembers)
    .where(and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.status, 'active'), inArray(groupMembers.userId, [...expectedUsers])));
  if (new Set(membersBefore.map(item => item.userId)).size !== expectedUsers.size) throw unprocessable('Todos los pagadores y participantes deben ser miembros activos del grupo', 'GROUP_MEMBER_REQUIRED');

  const id = randomUUID(); const now = new Date();
  return withIdempotency(userId, 'POST:/expenses', idempotencyKey, body, async tx => {
    const group = (await tx.select().from(groups).where(and(eq(groups.id, body.groupId), isNull(groups.archivedAt))).limit(1).for('update'))[0];
    if (!group) throw notFound('Grupo no encontrado');
    if (group.currency !== groupBefore.currency) throw conflict('La moneda del grupo cambió durante la operación; vuelve a intentarlo para recalcular la conversión', 'GROUP_CURRENCY_CHANGED');
    const memberRows = await tx.select({ userId: groupMembers.userId }).from(groupMembers)
      .where(and(eq(groupMembers.groupId, body.groupId), eq(groupMembers.status, 'active'), inArray(groupMembers.userId, [...expectedUsers])));
    if (new Set(memberRows.map(item => item.userId)).size !== expectedUsers.size) throw unprocessable('Todos los pagadores y participantes deben ser miembros activos del grupo', 'GROUP_MEMBER_REQUIRED');
    if (body.categoryId) {
      const category = (await tx.select().from(categories).where(eq(categories.id, body.categoryId)).limit(1))[0];
      if (!category || (category.groupId !== null && category.groupId !== body.groupId)) throw unprocessable('La categoría no existe o no pertenece al grupo', 'INVALID_CATEGORY');
    }
    await tx.insert(expenses).values({ id, groupId: body.groupId, title: body.title, description: body.description ?? null, amountMinor: originalAmount,
      currency: sourceCurrency, settlementAmountMinor: quote.settlementAmountMinor, settlementCurrency: group.currency, fxRate: quote.fxRate,
      fxSource: quote.fxSource, fxAsOf: quote.fxAsOf, paidBy: body.paidBy, createdBy: userId, splitType: body.splitType, categoryId: body.categoryId ?? null,
      date: body.date, version: 1, createdAt: now, updatedAt: now });
    await insertShares(tx, id, body.splitType, originalAmount, quote.settlementAmountMinor, sourceCurrency, group.currency, quote.fxRate ?? '1', body.splits);
    await auditEvent({ requestId, actorUserId: userId, action: 'expense.create', resourceType: 'expense', resourceId: id, metadata: { groupId: body.groupId, currency: sourceCurrency, splitType: body.splitType } }, tx);
    return { id, groupId: body.groupId, createdAt: now.toISOString() };
  });
}

expensesRouter.post('/', requireAuth, validateBody(createExpenseSchema), asyncHandler(async (req, res) => {
  const body = createExpenseSchema.parse(req.body);
  const { result, replayed } = await createExpenseCommand(req.auth!.userId, req.requestId, body, req.header('Idempotency-Key'));
  const output = await loadExpenseDTO(result.id, req.auth!.userId);
  res.setHeader('Idempotency-Replayed', String(replayed)); res.status(replayed ? 200 : 201).json(output);
}));

expensesRouter.get('/:expenseId', requireAuth, asyncHandler(async (req, res) => res.json(await loadExpenseDTO(String(req.params.expenseId), req.auth!.userId))));

export async function updateExpenseCommand(userId: string, requestId: string | undefined, expenseId: string, rawBody: unknown, idempotencyKey: string | undefined) {
  const body = updateExpenseSchema.parse(rawBody);
  if (body.date) asDateOnly(body.date);
  const operation = `PATCH:/expenses/${expenseId}`;
  const replay = await findIdempotentReplay<{ id: string; version: number }>(userId, operation, idempotencyKey, body);
  if (replay) return replay;
  const current = (await db.select().from(expenses).innerJoin(groupMembers,
    and(eq(groupMembers.groupId, expenses.groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, 'active')))
    .where(and(eq(expenses.id, expenseId), isNull(expenses.archivedAt))).limit(1))[0]?.expenses;
  if (!current) throw notFound('Gasto no encontrado');
  const preflightMember = await getMembership(current.groupId, userId);
  if (current.createdBy !== userId && current.paidBy !== userId) await assertGroupPermission(current.groupId, userId, 'expenses:update_any');
  else if (preflightMember.role !== 'owner' && preflightMember.role !== 'admin') await assertGroupPermission(current.groupId, userId, 'expenses:update_own');

  const changesMoney = body.amountMinor !== undefined || body.currency !== undefined || body.splitType !== undefined || body.splits !== undefined || body.fxRate !== undefined;
  const groupBefore = (await db.select().from(groups).where(eq(groups.id, current.groupId)).limit(1))[0];
  if (!groupBefore || groupBefore.archivedAt) throw notFound('Grupo no encontrado');
  const oldShares = await db.select().from(expenseShares).where(eq(expenseShares.expenseId, expenseId));
  const splitType = (body.splitType ?? current.splitType) as 'equal' | 'custom' | 'percentage';
  const sourceCurrency = body.currency ?? current.currency;
  const amount = body.amountMinor !== undefined ? assertPositiveSafeMinor(body.amountMinor) : current.amountMinor;
  if (body.splitType && body.splitType !== current.splitType && !body.splits) throw unprocessable('Al cambiar el tipo de reparto, envía las nuevas participaciones.', 'SPLITS_REQUIRED');
  if (current.splitType === 'custom' && (body.amountMinor !== undefined || body.currency !== undefined) && !body.splits) throw unprocessable('Al cambiar el importe o moneda de un reparto por montos, envía las nuevas participaciones.', 'CUSTOM_SPLIT_REQUIRED');
  const shareInput = body.splits ?? oldShares.map(share => ({
    userId: share.userId,
    ...(splitType === 'custom' ? { amountMinor: safeNumber(share.originalAmountMinor) } : {}),
    ...(splitType === 'percentage' ? { percentage: (share.percentageBasisPoints ?? 0) / 100 } : {}),
  }));
  const quote = changesMoney
    ? await quoteForExpense(sourceCurrency, groupBefore.currency, amount, body.fxRate)
    : { settlementAmountMinor: current.settlementAmountMinor, fxRate: current.fxRate, fxSource: current.fxSource, fxAsOf: current.fxAsOf ?? new Date() };
  if (quote.settlementAmountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw unprocessable('El importe convertido excede el rango admitido por la API', 'AMOUNT_TOO_LARGE');
  const membersBefore = await db.select({ userId: groupMembers.userId }).from(groupMembers)
    .where(and(eq(groupMembers.groupId, current.groupId), eq(groupMembers.status, 'active'), inArray(groupMembers.userId, [...new Set([current.paidBy, ...shareInput.map(share => share.userId)])])));
  const expectedMembers = new Set([current.paidBy, ...shareInput.map(share => share.userId)]);
  if (new Set(membersBefore.map(item => item.userId)).size !== expectedMembers.size) throw unprocessable('Todos los pagadores y participantes deben ser miembros activos del grupo', 'GROUP_MEMBER_REQUIRED');
  if (body.categoryId) {
    const category = (await db.select().from(categories).where(eq(categories.id, body.categoryId)).limit(1))[0];
    if (!category || (category.groupId !== null && category.groupId !== current.groupId)) throw unprocessable('La categoría no existe o no pertenece al grupo', 'INVALID_CATEGORY');
  }

  return withIdempotency(userId, operation, idempotencyKey, body, async tx => {
    const lockedGroup = (await tx.select().from(groups).where(eq(groups.id, current.groupId)).limit(1).for('update'))[0];
    if (!lockedGroup || lockedGroup.archivedAt) throw notFound('Grupo no encontrado');
    if (lockedGroup.currency !== groupBefore.currency) throw conflict('La moneda del grupo cambió durante la operación; vuelve a intentarlo', 'GROUP_CURRENCY_CHANGED');
    const lockedCurrent = (await tx.select().from(expenses).where(and(eq(expenses.id, expenseId), isNull(expenses.archivedAt))).limit(1).for('update'))[0];
    if (!lockedCurrent) throw notFound('Gasto no encontrado');
    if (lockedCurrent.version !== current.version) throw conflict('El gasto cambió desde que comenzaste a editarlo; recarga los datos e inténtalo de nuevo', 'EXPENSE_VERSION_CONFLICT');
    const requiredPermission = lockedCurrent.createdBy === userId || lockedCurrent.paidBy === userId ? 'expenses:update_own' : 'expenses:update_any';
    const member = await assertGroupPermissionTx(tx, lockedCurrent.groupId, userId, requiredPermission);
    if (member.role === 'owner' || member.role === 'admin') { /* elevated group roles may update any expense */ }
    else if (requiredPermission === 'expenses:update_any') throw unprocessable('No puedes editar este gasto', 'EXPENSE_EDIT_NOT_ALLOWED');
    if (changesMoney) {
      const activeSettlement = await tx.select({ id: settlements.id }).from(settlements).where(and(eq(settlements.groupId, current.groupId), ne(settlements.status, 'cancelled'))).limit(1);
      if (activeSettlement[0]) throw conflict('No se puede alterar el importe o reparto mientras exista una liquidación declarada, disputada o confirmada en el grupo; cancela la pendiente o registra un ajuste auditable', 'FINANCIAL_HISTORY_LOCKED');
    }
    const memberRows = await tx.select({ userId: groupMembers.userId }).from(groupMembers)
      .where(and(eq(groupMembers.groupId, current.groupId), eq(groupMembers.status, 'active'), inArray(groupMembers.userId, [...expectedMembers])));
    if (new Set(memberRows.map(item => item.userId)).size !== expectedMembers.size) throw unprocessable('Todos los pagadores y participantes deben ser miembros activos del grupo', 'GROUP_MEMBER_REQUIRED');
    const now = new Date();
    await tx.update(expenses).set({ title: body.title ?? current.title, description: body.description === undefined ? current.description : body.description,
      amountMinor: amount, currency: sourceCurrency, settlementAmountMinor: quote.settlementAmountMinor, settlementCurrency: lockedGroup.currency,
      fxRate: quote.fxRate, fxSource: quote.fxSource, fxAsOf: quote.fxAsOf, splitType,
      categoryId: body.categoryId === undefined ? current.categoryId : body.categoryId, date: body.date ?? current.date,
      version: current.version + 1, updatedAt: now }).where(eq(expenses.id, expenseId));
    if (changesMoney || body.splits || body.splitType) {
      await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
      await insertShares(tx, expenseId, splitType, amount, quote.settlementAmountMinor, sourceCurrency, lockedGroup.currency, quote.fxRate ?? '1', shareInput);
    }
    await auditEvent({ requestId, actorUserId: userId, action: 'expense.update', resourceType: 'expense', resourceId: expenseId, metadata: { changedFields: Object.keys(body), version: current.version + 1 } }, tx);
    return { id: expenseId, version: current.version + 1 };
  });
}

expensesRouter.patch('/:expenseId', requireAuth, validateBody(updateExpenseSchema), asyncHandler(async (req, res) => {
  const result = await updateExpenseCommand(req.auth!.userId, req.requestId, String(req.params.expenseId), req.body, req.header('Idempotency-Key'));
  const output = await loadExpenseDTO(result.result.id, req.auth!.userId);
  res.setHeader('Idempotency-Replayed', String(result.replayed));
  res.status(200).json(output);
}));

export async function archiveExpenseCommand(userId: string, requestId: string | undefined, expenseId: string, idempotencyKey: string | undefined) {
  const operation = `DELETE:/expenses/${expenseId}`; const payload = { expenseId };
  const replay = await findIdempotentReplay<{ id: string; archivedAt: string }>(userId, operation, idempotencyKey, payload);
  if (replay) return replay;
  const current = (await db.select().from(expenses).innerJoin(groupMembers,
    and(eq(groupMembers.groupId, expenses.groupId), eq(groupMembers.userId, userId), eq(groupMembers.status, 'active')))
    .where(and(eq(expenses.id, expenseId), isNull(expenses.archivedAt))).limit(1))[0]?.expenses;
  if (!current) throw notFound('Gasto no encontrado');
  const member = await getMembership(current.groupId, userId);
  if (current.createdBy !== userId && current.paidBy !== userId) await assertGroupPermission(current.groupId, userId, 'expenses:delete_any');
  else if (member.role !== 'owner' && member.role !== 'admin') await assertGroupPermission(current.groupId, userId, 'expenses:delete_own');
  return withIdempotency(userId, operation, idempotencyKey, payload, async tx => {
    const group = (await tx.select().from(groups).where(eq(groups.id, current.groupId)).limit(1).for('update'))[0];
    if (!group || group.archivedAt) throw notFound('Grupo no encontrado');
    const locked = (await tx.select().from(expenses).where(and(eq(expenses.id, expenseId), isNull(expenses.archivedAt))).limit(1).for('update'))[0];
    if (!locked) throw notFound('Gasto no encontrado');
    if (locked.version !== current.version) throw conflict('El gasto cambió antes de archivarse; vuelve a cargarlo', 'EXPENSE_VERSION_CONFLICT');
    const requiredPermission = locked.createdBy === userId || locked.paidBy === userId ? 'expenses:delete_own' : 'expenses:delete_any';
    const actor = await assertGroupPermissionTx(tx, locked.groupId, userId, requiredPermission);
    if (actor.role !== 'owner' && actor.role !== 'admin' && requiredPermission === 'expenses:delete_any') throw forbidden('No tienes permiso para archivar este gasto');
    const activeSettlement = await tx.select({ id: settlements.id }).from(settlements).where(and(eq(settlements.groupId, current.groupId), ne(settlements.status, 'cancelled'))).limit(1);
    if (activeSettlement[0]) throw conflict('No se puede archivar este gasto mientras exista una liquidación declarada, disputada o confirmada en el grupo; cancela la pendiente o registra un ajuste auditable', 'FINANCIAL_HISTORY_LOCKED');
    const now = new Date();
    await tx.update(expenses).set({ archivedAt: now, updatedAt: now, version: locked.version + 1 }).where(eq(expenses.id, expenseId));
    await auditEvent({ requestId, actorUserId: userId, action: 'expense.archive', resourceType: 'expense', resourceId: expenseId, metadata: { groupId: current.groupId } }, tx);
    return { id: expenseId, archivedAt: now.toISOString() };
  });
}

expensesRouter.delete('/:expenseId', requireAuth, asyncHandler(async (req, res) => {
  const result = await archiveExpenseCommand(req.auth!.userId, req.requestId, String(req.params.expenseId), req.header('Idempotency-Key'));
  res.setHeader('Idempotency-Replayed', String(result.replayed));
  res.status(204).end();
}));
