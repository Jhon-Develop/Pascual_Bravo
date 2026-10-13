import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';
import multer from 'multer';
import { env } from './config/env.js';
import { AppError } from './shared/errors/app-error.js';
import { optionalAuth, protectCookieMutations } from './shared/http/auth.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { groupsRouter } from './modules/groups/groups.routes.js';
import { groupInvitationsRouter, invitationsRouter } from './modules/invitations/invitations.routes.js';
import { expensesRouter } from './modules/expenses/expenses.routes.js';
import { balancesRouter } from './modules/balances/balances.routes.js';
import { settlementsRouter } from './modules/settlements/settlements.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { receiptsRouter } from './modules/receipts/receipts.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { fxRouter } from './modules/fx/fx.routes.js';
import { fileURLToPath } from 'node:url';

export const logger = pino({ level: env.LOG_LEVEL, redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["set-cookie"]', 'password', 'passwordHash', 'token', 'tokenHash', 'SESSION_SECRET', 'SMTP_PASSWORD'], censor: '[REDACTED]' } });

function endpointRateLimit(windowMs: number, limit: number, message: string) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res) => {
    res.status(429).json({ code: 'RATE_LIMITED', message, statusCode: 429, requestId: req.requestId });
  } });
}

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger, genReqId: req => {
    const provided = req.headers['x-request-id'];
    const candidate = Array.isArray(provided) ? provided[0] : provided;
    return candidate && /^[A-Za-z0-9_-]{1,64}$/.test(candidate) ? candidate : randomUUID();
  }, customProps: req => ({ requestId: (req as typeof req & { id?: string }).id }) }));
  app.use((req, res, next) => { const id = (req as typeof req & { id?: string }).id ?? randomUUID(); req.requestId = id; res.setHeader('X-Request-ID', id); next(); });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, contentSecurityPolicy: false }));
  app.use(cors({ origin(origin, callback) {
    if (!origin) return callback(null, true); // CLI/mobile requests have no Origin; cookie mutation guard still rejects absent origin if cookie-authenticated.
    if (env.frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'El origen no está permitido'));
  }, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID'], exposedHeaders: ['X-Request-ID', 'Idempotency-Replayed', 'Content-Disposition'], maxAge: 600 }));
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 50 }));
  app.use(cookieParser());
  app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res) => { res.status(429).json({ code: 'RATE_LIMITED', message: 'Demasiadas solicitudes; inténtalo de nuevo más tarde', statusCode: 429, requestId: req.requestId }); } }));
  app.use(healthRouter);

  const api = express.Router();
  api.use(optionalAuth, protectCookieMutations);
  // Sensitive flows have a stricter per-IP limit than the general API limiter.
  api.use('/auth/register', endpointRateLimit(15 * 60_000, 8, 'Demasiados intentos de registro; inténtalo más tarde'));
  api.use('/auth/login', endpointRateLimit(15 * 60_000, 10, 'Demasiados intentos de inicio de sesión; inténtalo más tarde'));
  api.use('/auth/forgot-password', endpointRateLimit(15 * 60_000, 5, 'Demasiadas solicitudes de recuperación; inténtalo más tarde'));
  api.use('/auth/reset-password', endpointRateLimit(15 * 60_000, 10, 'Demasiados intentos de restablecimiento; inténtalo más tarde'));
  api.use('/invitations/accept', endpointRateLimit(15 * 60_000, 12, 'Demasiados intentos de invitación; inténtalo más tarde'));
  api.use('/groups/:groupId/invitations', endpointRateLimit(60 * 60_000, 20, 'Demasiadas invitaciones; inténtalo más tarde'));
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/groups', groupsRouter);
  api.use('/groups', groupInvitationsRouter);
  api.use('/invitations', invitationsRouter);
  api.use('/expenses', expensesRouter);
  api.use('/', balancesRouter);
  api.use('/settlements', settlementsRouter);
  api.use('/categories', categoriesRouter);
  api.use('/', reportsRouter);
  api.use('/sync', syncRouter);
  api.use('/fx', fxRouter);
  api.use('/', healthRouter);
  api.get('/openapi.json', (_req, res) => res.sendFile(fileURLToPath(new URL('../docs/openapi.json', import.meta.url))));
  api.get('/docs', (_req, res) => res.type('text').send('Pazito API v1. OpenAPI JSON: /api/v1/openapi.json'));
  api.use('/', receiptsRouter);
  api.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint no encontrado')));
  app.use('/api/v1', api);

  const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
    let normalized: AppError;
    if (error instanceof AppError) normalized = error;
    else if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.issues) (details[issue.path.join('.') || 'body'] ??= []).push(issue.message);
      normalized = new AppError(400, 'VALIDATION_ERROR', 'Datos de entrada inválidos', details);
    } else if (error instanceof multer.MulterError) {
      normalized = new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'RECEIPT_TOO_LARGE' : 'UPLOAD_INVALID', error.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo' : 'No se pudo procesar el archivo');
    } else {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
      const type = error && typeof error === 'object' && 'type' in error ? String((error as { type: unknown }).type) : '';
      if (code === 'ER_DUP_ENTRY') normalized = new AppError(409, 'CONFLICT', 'El recurso ya existe o duplica una clave única');
      else if (type === 'entity.parse.failed') normalized = new AppError(400, 'INVALID_JSON', 'El cuerpo JSON no es válido');
      else if (type === 'entity.too.large') normalized = new AppError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud supera el tamaño máximo');
      else if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'PROTOCOL_CONNECTION_LOST') normalized = new AppError(503, 'SERVICE_UNAVAILABLE', 'El servicio requerido no está disponible');
      else normalized = new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno');
    }
    logger[normalized.statusCode >= 500 ? 'error' : 'warn']({ requestId: req.requestId, method: req.method, path: req.path, statusCode: normalized.statusCode, code: normalized.code, errName: error instanceof Error ? error.name : 'UnknownError' }, 'Solicitud fallida');
    if (res.headersSent) return;
    res.status(normalized.statusCode).json({ code: normalized.code, message: normalized.message, ...(normalized.details ? { details: normalized.details } : {}), statusCode: normalized.statusCode, requestId: req.requestId });
  };
  app.use(errorHandler);
  return app;
}
