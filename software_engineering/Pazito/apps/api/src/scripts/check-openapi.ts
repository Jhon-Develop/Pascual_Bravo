import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const base = fileURLToPath(new URL('../../', import.meta.url));
const apiPath = join(base, 'docs', 'openapi.json');
const raw = await readFile(apiPath, 'utf8');
const document = JSON.parse(raw) as { openapi?: string; paths?: Record<string, Record<string, unknown>> };
if (!document.openapi?.startsWith('3.') || !document.paths) throw new Error('OpenAPI debe ser una especificación 3.x con paths.');
const required: Array<[string, string]> = [
  ['/auth/register', 'post'], ['/auth/login', 'post'], ['/groups', 'get'], ['/groups', 'post'],
  ['/groups/{groupId}/invitations', 'post'], ['/expenses', 'get'], ['/expenses', 'post'],
  ['/groups/{groupId}/balances', 'get'], ['/settlements', 'post'], ['/fx/rate', 'get'],
  ['/expenses/{expenseId}/receipts', 'post'], ['/groups/{groupId}/export', 'get'], ['/sync/expenses', 'post'],
];
const missing = required.filter(([path, method]) => !document.paths?.[path]?.[method]);
if (missing.length) throw new Error(`Faltan operaciones OpenAPI documentadas: ${missing.map(([p, m]) => `${m.toUpperCase()} ${p}`).join(', ')}`);
console.log(`OpenAPI OK: ${Object.keys(document.paths).length} rutas; ${required.length} operaciones críticas verificadas.`);
