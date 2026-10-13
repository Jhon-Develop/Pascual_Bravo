import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import { Router } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../infrastructure/database/client.js';
import { expenses, groupMembers, receipts } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { assertGroupPermission } from '../groups/permissions.service.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';
import { conflict, notFound, unprocessable } from '../../shared/errors/app-error.js';
import { env } from '../../config/env.js';

export const receiptsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.RECEIPTS_MAX_BYTES, files: 1, fields: 4, parts: 5 } });
const allowed = new Map([['application/pdf', 'pdf'], ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const storageDirectory = () => resolve(process.cwd(), env.RECEIPTS_DIR);
const receiptUploadLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { code: 'RATE_LIMITED', message: 'Demasiadas cargas de recibos; inténtalo más tarde', statusCode: 429 } });

receiptsRouter.post('/expenses/:expenseId/receipts', requireAuth, receiptUploadLimit, upload.single('file'), asyncHandler(async (req, res) => {
  const expenseId = String(req.params.expenseId);
  const expense = (await db.select({ expense: expenses }).from(expenses).innerJoin(groupMembers, and(eq(groupMembers.groupId, expenses.groupId), eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active'))).where(and(eq(expenses.id, expenseId), isNull(expenses.archivedAt))).limit(1))[0]?.expense;
  if (!expense) throw notFound('Gasto no encontrado'); await assertGroupPermission(expense.groupId, req.auth!.userId, 'receipts:manage');
  const file = req.file; if (!file) throw unprocessable('Adjunta un archivo en el campo file', 'RECEIPT_REQUIRED');
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !allowed.has(detected.mime)) throw unprocessable('Formato de recibo no permitido. Usa PDF, JPEG, PNG o WEBP', 'RECEIPT_TYPE_NOT_ALLOWED');
  if (file.buffer.length > env.RECEIPTS_MAX_BYTES) throw unprocessable('El recibo supera el tamaño máximo configurado', 'RECEIPT_TOO_LARGE');
  const id = randomUUID(); const storageKey = `${id}.${allowed.get(detected.mime)!}`; const directory = storageDirectory();
  await mkdir(directory, { recursive: true }); await writeFile(join(directory, storageKey), file.buffer, { flag: 'wx', mode: 0o600 });
  try {
    const originalName = file.originalname.replace(/[\r\n\\/\0]/g, '_').slice(0, 255) || `recibo.${extname(storageKey).slice(1)}`;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    await db.insert(receipts).values({ id, expenseId, uploadedBy: req.auth!.userId, originalName, mimeType: detected.mime, sizeBytes: file.buffer.length, sha256, storageKey });
    await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'receipt.upload', resourceType: 'receipt', resourceId: id, metadata: { expenseId, mimeType: detected.mime, sizeBytes: file.buffer.length } });
    res.status(201).json({ id, expenseId, originalName, mimeType: detected.mime, sizeBytes: file.buffer.length, sha256, createdAt: new Date().toISOString() });
  } catch (error) { await unlink(join(directory, storageKey)).catch(() => undefined); throw error; }
}));

receiptsRouter.get('/receipts/:receiptId', requireAuth, asyncHandler(async (req, res) => {
  const receiptId = String(req.params.receiptId); const rows = await db.select({ receipt: receipts, expense: expenses }).from(receipts).innerJoin(expenses, eq(expenses.id, receipts.expenseId))
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, expenses.groupId), eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active')))
    .where(eq(receipts.id, receiptId)).limit(1);
  const row = rows[0]; if (!row) throw notFound('Recibo no encontrado'); await assertGroupPermission(row.expense.groupId, req.auth!.userId, 'receipts:manage');
  const path = join(storageDirectory(), row.receipt.storageKey); const data = await readFile(path).catch(() => null);
  if (!data) throw notFound('El archivo del recibo no está disponible');
  res.setHeader('Content-Type', row.receipt.mimeType); res.setHeader('Content-Length', String(data.length));
  res.setHeader('Content-Disposition', `attachment; filename="recibo-${receiptId}.${allowed.get(row.receipt.mimeType) ?? 'bin'}"`);
  res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.send(data);
}));

receiptsRouter.delete('/receipts/:receiptId', requireAuth, asyncHandler(async (req, res) => {
  const receiptId = String(req.params.receiptId); const rows = await db.select({ receipt: receipts, expense: expenses }).from(receipts).innerJoin(expenses, eq(expenses.id, receipts.expenseId))
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, expenses.groupId), eq(groupMembers.userId, req.auth!.userId), eq(groupMembers.status, 'active'))).where(eq(receipts.id, receiptId)).limit(1);
  const row = rows[0]; if (!row) throw notFound('Recibo no encontrado'); await assertGroupPermission(row.expense.groupId, req.auth!.userId, 'receipts:manage');
  await db.delete(receipts).where(eq(receipts.id, receiptId)); await unlink(join(storageDirectory(), row.receipt.storageKey)).catch(() => undefined);
  await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'receipt.delete', resourceType: 'receipt', resourceId: receiptId, metadata: { expenseId: row.expense.id } });
  res.status(204).end();
}));
