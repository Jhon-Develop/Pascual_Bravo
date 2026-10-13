import type { RequestHandler } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../infrastructure/database/client.js';
import { sessions, users } from '../../infrastructure/database/schema.js';
import { sha256 } from '../security/crypto.js';
import { AppError, unauthorized } from '../errors/app-error.js';
import { env } from '../../config/env.js';

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header('authorization');
    const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookieToken = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    const token = bearer ?? cookieToken;
    if (!token) return next();
    const tokenHash = sha256(token);
    const rows = await db.select({
      sessionTokenHash: sessions.tokenHash, sessionUserId: sessions.userId, expiresAt: sessions.expiresAt, lastSeenAt: sessions.lastSeenAt,
      id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl, createdAt: users.createdAt, updatedAt: users.updatedAt,
      deactivatedAt: users.deactivatedAt,
    }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()), isNull(users.deactivatedAt))).limit(1);
    const row = rows[0];
    if (!row) return next();
    req.auth = {
      userId: row.id, sessionHash: row.sessionTokenHash, viaCookie: !bearer,
      user: { id: row.id, email: row.email, name: row.name, avatarUrl: row.avatarUrl, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() },
    };
    // Keep lastSeenAt approximate and avoid writing on every request.
    if (Date.now() - row.lastSeenAt.getTime() > 15 * 60_000) {
      void db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.tokenHash, tokenHash)).catch(() => undefined);
    }
    return next();
  } catch (error) { return next(error); }
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  next();
};

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const protectCookieMutations: RequestHandler = (req, _res, next) => {
  if (!req.auth?.viaCookie || !MUTATING.has(req.method)) return next();
  const origin = req.header('origin');
  const referer = req.header('referer');
  let sourceOrigin = origin;
  if (!sourceOrigin && referer) { try { sourceOrigin = new URL(referer).origin; } catch { sourceOrigin = undefined; } }
  // Requiring an exact trusted origin for cookie-authenticated mutations prevents simple cross-site form CSRF.
  if (!sourceOrigin || !env.frontendOrigins.includes(sourceOrigin)) return next(new AppError(403, 'CSRF_ORIGIN_REJECTED', 'El origen de esta solicitud no está autorizado'));
  next();
};
