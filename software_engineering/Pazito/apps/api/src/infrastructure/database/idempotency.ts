import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { DbTransaction } from './client.js';
import { db } from './client.js';
import { idempotencyKeys } from './schema.js';
import { conflict, badRequest } from '../../shared/errors/app-error.js';
import { sha256, stableStringify, sealJson, unsealJson } from '../../shared/security/crypto.js';

function isDuplicateKey(error: unknown): boolean { return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY'; }

export type IdempotentResult<T> = { result: T; replayed: boolean };
function validateKey(key: string | undefined): asserts key is string {
  if (!key || key.length < 8 || key.length > 100) throw badRequest('Se requiere un encabezado Idempotency-Key válido', 'IDEMPOTENCY_KEY_REQUIRED');
}
/** Fast replay lookup lets callers perform all expensive/non-transactional preflight work before opening a SQL transaction. */
export async function findIdempotentReplay<T>(userId: string, operation: string, key: string | undefined, payload: unknown): Promise<IdempotentResult<T> | null> {
  validateKey(key);
  const payloadHash = sha256(stableStringify(payload));
  const existing = await db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.key, key))).limit(1);
  if (!existing[0]) return null;
  if (existing[0].payloadHash !== payloadHash) throw conflict('Esta clave de idempotencia ya se utilizó con datos diferentes', 'IDEMPOTENCY_KEY_REUSED');
  if (existing[0].responseJson === null) throw conflict('La operación está pendiente de completarse; vuelve a intentarlo con la misma clave', 'IDEMPOTENCY_IN_PROGRESS');
  return { result: unsealJson(existing[0].responseJson) as T, replayed: true };
}

export async function withIdempotency<T>(userId: string, operation: string, key: string | undefined, payload: unknown, action: (tx: DbTransaction) => Promise<T>): Promise<{ result: T; replayed: boolean }> {
  validateKey(key);
  const payloadHash = sha256(stableStringify(payload));
  try {
    const result = await db.transaction(async (tx) => {
      await tx.insert(idempotencyKeys).values({ id: randomUUID(), userId, operation, key, payloadHash, responseJson: null, statusCode: 200 });
      const created = await action(tx);
      await tx.update(idempotencyKeys).set({ responseJson: sealJson(created), statusCode: 200 }).where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.key, key)));
      return created;
    });
    return { result, replayed: false };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const existing = await db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.key, key))).limit(1);
    if (!existing[0]) throw error;
    if (existing[0].payloadHash !== payloadHash) throw conflict('Esta clave de idempotencia ya se utilizó con datos diferentes', 'IDEMPOTENCY_KEY_REUSED');
    if (existing[0].responseJson === null) throw conflict('La operación está pendiente de completarse; vuelve a intentarlo con la misma clave', 'IDEMPOTENCY_IN_PROGRESS');
    return { result: unsealJson(existing[0].responseJson) as T, replayed: true };
  }
}
