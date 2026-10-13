import { Router } from 'express';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import { exportQuerySchema } from '@pazito/contracts';
import { db } from '../../infrastructure/database/client.js';
import { expenses, expenseShares, groups, settlements, users } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { assertGroupPermission } from '../groups/permissions.service.js';
import { toSafeAmount } from '../../shared/validation/currency.js';
import { badRequest, notFound } from '../../shared/errors/app-error.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';

export const reportsRouter = Router();
function csvCell(value: unknown) { const text = String(value ?? ''); return `"${text.replace(/"/g, '""')}"`; }
function minorToMajorString(amountMinor: bigint, currency: string) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  const base = 10n ** BigInt(digits); const whole = amountMinor / base; const fraction = (amountMinor % base).toString().padStart(digits, '0');
  return digits ? `${whole}.${fraction}` : whole.toString();
}

reportsRouter.get('/groups/:groupId/export', requireAuth, asyncHandler(async (req, res) => {
  const groupId = String(req.params.groupId); await assertGroupPermission(groupId, req.auth!.userId, 'reports:export');
  const query = exportQuerySchema.parse(req.query); const group = (await db.select().from(groups).where(and(eq(groups.id, groupId), isNull(groups.archivedAt))).limit(1))[0];
  if (!group) throw notFound('Grupo no encontrado');
  if (query.from && query.to && (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000 > 731) throw badRequest('El rango máximo para un informe es de dos años', 'REPORT_RANGE_TOO_LARGE');
  const conditions = [eq(expenses.groupId, groupId), isNull(expenses.archivedAt)]; if (query.from) conditions.push(gte(expenses.date, query.from)); if (query.to) conditions.push(lte(expenses.date, query.to));
  const rows = await db.select({ expense: expenses, payer: users }).from(expenses).innerJoin(users, eq(users.id, expenses.paidBy)).where(and(...conditions)).orderBy(expenses.date);
  const settlementConditions = [eq(settlements.groupId, groupId)];
  if (query.from) settlementConditions.push(gte(settlements.declaredAt, new Date(`${query.from}T00:00:00.000Z`)));
  if (query.to) settlementConditions.push(lte(settlements.declaredAt, new Date(`${query.to}T23:59:59.999Z`)));
  const paymentRows = await db.select().from(settlements).where(and(...settlementConditions)).orderBy(settlements.declaredAt);
  const expenseIds = rows.map(r => r.expense.id); const shares = expenseIds.length ? await db.select({ share: expenseShares, user: users }).from(expenseShares).innerJoin(users, eq(users.id, expenseShares.userId)).where(inArray(expenseShares.expenseId, expenseIds)) : [];
  const sharesByExpense = new Map<string, string[]>(); for (const share of shares) { if (!sharesByExpense.has(share.share.expenseId)) sharesByExpense.set(share.share.expenseId, []); sharesByExpense.get(share.share.expenseId)!.push(`${share.user.name}: ${minorToMajorString(share.share.amountMinor, group.currency)} ${group.currency}`); }
  const partyIds = [...new Set(paymentRows.flatMap(payment => [payment.fromUserId, payment.toUserId]))];
  const parties = partyIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, partyIds)) : [];
  const partyName = new Map(parties.map(party => [party.id, party.name]));
  const filename = `pazito-${groupId}-${new Date().toISOString().slice(0, 10)}`;
  await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'report.export', resourceType: 'group', resourceId: groupId, metadata: { format: query.format, expenses: rows.length, settlements: paymentRows.length } });
  if (query.format === 'csv') {
    const header = ['Fecha', 'Tipo', 'Estado', 'Título', 'Descripción', 'Pagador / origen', 'Destinatario', 'Importe original', 'Moneda original', 'Importe liquidación', 'Moneda liquidación', 'Tasa FX', 'Fuente FX', 'Participaciones'];
    const expenseLines = rows.map(({ expense, payer }) => [expense.date, 'Gasto', expense.archivedAt ? 'archivado' : 'activo', expense.title, expense.description ?? '', payer.name, '', minorToMajorString(expense.amountMinor, expense.currency), expense.currency, minorToMajorString(expense.settlementAmountMinor, expense.settlementCurrency), expense.settlementCurrency, expense.fxRate ?? '', expense.fxSource ?? '', (sharesByExpense.get(expense.id) ?? []).join('; ')]);
    const settlementLines = paymentRows.map(payment => [payment.declaredAt.toISOString().slice(0, 10), 'Liquidación', payment.status, `Pago de ${partyName.get(payment.fromUserId) ?? 'Usuario'} a ${partyName.get(payment.toUserId) ?? 'Usuario'}`, payment.disputeReason ?? '', partyName.get(payment.fromUserId) ?? 'Usuario', partyName.get(payment.toUserId) ?? 'Usuario', minorToMajorString(payment.amountMinor, payment.currency), payment.currency, minorToMajorString(payment.amountMinor, payment.currency), payment.currency, '', '', `Declarado: ${payment.declaredAt.toISOString()}${payment.confirmedAt ? `; confirmado: ${payment.confirmedAt.toISOString()}` : ''}`]);
    const lines = [header, ...expenseLines, ...settlementLines];
    const content = `\uFEFF${lines.map(line => line.map(csvCell).join(',')).join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`); res.setHeader('Cache-Control', 'private, no-store');
    return res.send(content);
  }
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`); res.setHeader('Cache-Control', 'private, no-store');
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Informe Pazito - ${group.name}`, Author: 'Pazito' } }); doc.pipe(res);
  doc.fontSize(20).text(`Pazito · ${group.name}`); doc.moveDown(0.3).fontSize(10).text(`Informe de gastos y liquidaciones · moneda de liquidación ${group.currency}`); doc.text(`Generado: ${new Date().toLocaleString('es-CO')}${query.from ? ` · Desde ${query.from}` : ''}${query.to ? ` · Hasta ${query.to}` : ''}`); doc.moveDown();
  for (const { expense, payer } of rows) {
    if (doc.y > 740) doc.addPage();
    doc.fontSize(11).text(`${expense.date} · ${expense.title}`, { continued: true }).fontSize(10).text(`  ${minorToMajorString(expense.amountMinor, expense.currency)} ${expense.currency} · liquidación ${minorToMajorString(expense.settlementAmountMinor, expense.settlementCurrency)} ${expense.settlementCurrency}`);
    doc.fontSize(9).fillColor('#555555').text(`Pagó: ${payer.name}${expense.description ? ` · ${expense.description}` : ''}`);
    const shareText = sharesByExpense.get(expense.id)?.join(' | '); if (shareText) doc.text(`Reparto: ${shareText}`, { width: 520 }); doc.fillColor('#000000').moveDown(0.5);
  }
  if (paymentRows.length) {
    doc.addPage(); doc.fontSize(15).text('Historial de liquidaciones'); doc.moveDown(0.5);
    for (const payment of paymentRows) {
      if (doc.y > 740) doc.addPage();
      doc.fontSize(11).text(`${payment.declaredAt.toISOString().slice(0, 10)} · ${partyName.get(payment.fromUserId) ?? 'Usuario'} → ${partyName.get(payment.toUserId) ?? 'Usuario'}`);
      doc.fontSize(10).text(`${minorToMajorString(payment.amountMinor, payment.currency)} ${payment.currency} · estado: ${payment.status}`);
      if (payment.disputeReason) doc.fontSize(9).fillColor('#555555').text(`Motivo de disputa: ${payment.disputeReason}`).fillColor('#000000');
      if (payment.confirmedAt) doc.fontSize(9).text(`Confirmado: ${payment.confirmedAt.toISOString()}`);
      doc.moveDown(0.5);
    }
  }
  doc.end();
}));
