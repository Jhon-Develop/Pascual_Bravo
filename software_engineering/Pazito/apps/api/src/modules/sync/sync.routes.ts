import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { createExpenseCommand } from '../expenses/expenses.routes.js';
import { AppError } from '../../shared/errors/app-error.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';

export const syncRouter = Router();
const syncSchema = z.object({
  operations: z.array(z.object({
    clientOperationId: z.string().uuid(), type: z.literal('expense.create'),
    payload: z.record(z.string(), z.unknown()), clientCreatedAt: z.string().datetime().optional(),
  })).min(1).max(50),
});

syncRouter.post('/expenses', requireAuth, asyncHandler(async (req, res) => {
  const body = syncSchema.parse(req.body); const results: Array<Record<string, unknown>> = [];
  // Each operation is independently atomic and idempotent. A batch can partially succeed; every operation's outcome is returned.
  for (const operation of body.operations) {
    try {
      const { result, replayed } = await createExpenseCommand(req.auth!.userId, req.requestId, operation.payload, operation.clientOperationId);
      results.push({ clientOperationId: operation.clientOperationId, status: replayed ? 'already_synced' : 'synced', resourceId: result.id });
    } catch (error) {
      const known = error instanceof AppError;
      results.push({ clientOperationId: operation.clientOperationId, status: 'failed', code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'No se pudo sincronizar esta operación; puedes reintentar con la misma clave.' });
    }
  }
  const failed = results.filter(item => item.status === 'failed').length;
  await auditEvent({ requestId: req.requestId, actorUserId: req.auth!.userId, action: 'sync.expenses.batch', resourceType: 'sync_batch', metadata: { count: results.length, failed } });
  res.status(200).json({ results, summary: { total: results.length, synced: results.filter(r => r.status === 'synced' || r.status === 'already_synced').length, failed } });
}));
