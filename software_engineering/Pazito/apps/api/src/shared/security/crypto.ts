import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const timingSafeStringEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export function stableStringify(value: unknown): string {
  if (value === undefined) return '{\"$pazitoType\":\"undefined\"}';
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'null' : serialized;
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}


const storageKey = () => createHash('sha256').update(`pazito-idempotency:v1:${env.SESSION_SECRET}`).digest();
/** Encrypts idempotency result snapshots at rest (invitation URLs may contain bearer-like tokens). */
export function sealJson(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('La respuesta idempotente no es serializable como JSON');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', storageKey(), iv);
  const data = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  return { __pazito_sealed_v1: true, iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), data: data.toString('base64url') };
}
export function unsealJson(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('__pazito_sealed_v1' in value)) return value;
  const payload = value as { __pazito_sealed_v1: true; iv: string; tag: string; data: string };
  try {
    const decipher = createDecipheriv('aes-256-gcm', storageKey(), Buffer.from(payload.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const clear = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64url')), decipher.final()]).toString('utf8');
    return JSON.parse(clear) as unknown;
  } catch { throw new Error('No se pudo descifrar una respuesta idempotente; comprueba SESSION_SECRET'); }
}
