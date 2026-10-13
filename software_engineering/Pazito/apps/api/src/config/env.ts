import 'dotenv/config';
import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).default('false').transform(v => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'), API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_ORIGINS: z.string().default('http://localhost:4321,http://127.0.0.1:4321'),
  DATABASE_URL: z.string().min(1).default('mysql://pazito:pazito_dev_only@127.0.0.1:3306/pazito'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  SESSION_SECRET: z.string().min(32).default('dev-only-change-this-session-secret-0123456789'),
  SESSION_COOKIE_NAME: z.string().default('pazito_session'), SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(168),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  EMAIL_TRANSPORT: z.enum(['log', 'smtp', 'disabled']).default('log'), SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: booleanString, SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(), EMAIL_FROM: z.string().default('Pazito <no-reply@localhost>'),
  FX_PROVIDER: z.enum(['frankfurter', 'disabled']).default('frankfurter'), FX_API_BASE_URL: z.string().url().default('https://api.frankfurter.dev/v1'),
  FX_TIMEOUT_MS: z.coerce.number().int().min(500).max(15000).default(3500), FX_CACHE_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  RECEIPTS_DIR: z.string().default('./var/receipts'), RECEIPTS_MAX_BYTES: z.coerce.number().int().min(1024).max(25 * 1024 * 1024).default(5 * 1024 * 1024),
  TRUST_PROXY: booleanString, LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  throw new Error('Revisa las variables de entorno de apps/api/.env');
}
if (parsed.data.NODE_ENV === 'production' && (parsed.data.SESSION_SECRET.startsWith('dev-only') || parsed.data.SESSION_SECRET.startsWith('REPLACE_'))) {
  throw new Error('SESSION_SECRET debe ser aleatorio en producción');
}
if (parsed.data.NODE_ENV === 'production' && parsed.data.EMAIL_TRANSPORT !== 'smtp') {
  throw new Error('En producción configura EMAIL_TRANSPORT=smtp para que la recuperación de contraseña funcione; no se enviará correo en modo log/disabled');
}
if (parsed.data.EMAIL_TRANSPORT === 'smtp' && (!parsed.data.SMTP_HOST || !parsed.data.SMTP_USER || !parsed.data.SMTP_PASSWORD)) {
  throw new Error('EMAIL_TRANSPORT=smtp requiere SMTP_HOST, SMTP_USER y SMTP_PASSWORD');
}
export const env = { ...parsed.data, frontendOrigins: parsed.data.FRONTEND_ORIGINS.split(',').map(v => v.trim()).filter(Boolean) };
