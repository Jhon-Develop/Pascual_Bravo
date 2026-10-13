import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@pazito/contracts';
import { db } from '../../infrastructure/database/client.js';
import { passwordResetTokens, sessions, users } from '../../infrastructure/database/schema.js';
import { asyncHandler } from '../../shared/http/async-handler.js';
import { validateBody } from '../../shared/http/validate.js';
import { requireAuth } from '../../shared/http/auth.middleware.js';
import { conflict, notFound, unauthorized, unprocessable } from '../../shared/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../shared/security/password.js';
import { randomToken, sha256 } from '../../shared/security/crypto.js';
import { env } from '../../config/env.js';
import { emailService } from '../../infrastructure/mailer/email.service.js';
import { auditEvent } from '../../infrastructure/observability/audit.js';

export const authRouter = Router();
const cookieOptions = (maxAge?: number) => ({ httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', ...(maxAge ? { maxAge } : {}) });
function publicUser(user: typeof users.$inferSelect) {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}
async function createSession(user: typeof users.$inferSelect, req: import('express').Request, res: import('express').Response, rememberMe = false) {
  const token = randomToken(32); const expiresAt = new Date(Date.now() + (rememberMe ? 30 : env.SESSION_TTL_HOURS / 24) * 86_400_000);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId: user.id, expiresAt, userAgent: req.header('user-agent')?.slice(0, 512) ?? null, ipHash: req.ip ? sha256(req.ip) : null });
  res.cookie(env.SESSION_COOKIE_NAME, token, cookieOptions(expiresAt.getTime() - Date.now()));
  return { user: publicUser(user), accessToken: token, expiresAt: expiresAt.toISOString() };
}

authRouter.post('/register', validateBody(registerSchema), asyncHandler(async (req, res) => {
  const email = String(req.body.email).trim().toLocaleLowerCase('en-US');
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) throw conflict('No se pudo crear la cuenta con esos datos', 'ACCOUNT_EXISTS');
  const now = new Date(); const user = { id: randomUUID(), email, name: String(req.body.name).trim(), passwordHash: await hashPassword(String(req.body.password)), locale: 'es-CO', timezone: 'America/Bogota', createdAt: now, updatedAt: now };
  try { await db.insert(users).values(user); } catch (error) { if (isDuplicate(error)) throw conflict('No se pudo crear la cuenta con esos datos', 'ACCOUNT_EXISTS'); throw error; }
  await auditEvent({ requestId: req.requestId, actorUserId: user.id, action: 'auth.register', resourceType: 'user', resourceId: user.id });
  const created = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0]!;
  res.status(201).json(await createSession(created, req, res));
}));

authRouter.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
  const email = String(req.body.email).trim().toLocaleLowerCase('en-US'); const password = String(req.body.password);
  const result = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deactivatedAt))).limit(1);
  const user = result[0];
  if (!user || !(await verifyPassword(user.passwordHash, password))) throw unauthorized('Correo o contraseña incorrectos');
  await auditEvent({ requestId: req.requestId, actorUserId: user.id, action: 'auth.login', resourceType: 'user', resourceId: user.id });
  res.json(await createSession(user, req, res, Boolean(req.body.rememberMe)));
}));

authRouter.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await db.delete(sessions).where(eq(sessions.tokenHash, req.auth!.sessionHash));
  res.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions());
  res.status(204).end();
}));

authRouter.get('/me', requireAuth, (req, res) => res.json(req.auth!.user));

authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), asyncHandler(async (req, res) => {
  const email = String(req.body.email).trim().toLocaleLowerCase('en-US');
  const found = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deactivatedAt))).limit(1);
  let developmentResetUrl: string | undefined;
  if (found[0]) {
    const token = randomToken(32); const tokenHash = sha256(token); const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);
    await db.insert(passwordResetTokens).values({ tokenHash, userId: found[0].id, expiresAt });
    try {
      const delivery = await emailService.sendPasswordReset(found[0].email, found[0].name, token);
      developmentResetUrl = delivery.developmentUrl;
    } catch (error) {
      // Do not turn a mail outage into an account-enumeration side channel. Invalidate the undelivered token.
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).catch(() => undefined);
      await auditEvent({ requestId: req.requestId, actorUserId: found[0].id, action: 'auth.password_reset_email_failed', resourceType: 'user', resourceId: found[0].id, metadata: { errorType: error instanceof Error ? error.name : 'UnknownError' } }).catch(() => undefined);
    }
  }
  // Public response is generic whether the account is absent or delivery failed.
  res.json({ message: 'Si la cuenta existe, recibirás instrucciones para restablecer la contraseña.', ...(env.NODE_ENV === 'development' && developmentResetUrl ? { developmentResetUrl } : {}) });
}));

authRouter.post('/reset-password', validateBody(resetPasswordSchema), asyncHandler(async (req, res) => {
  const tokenHash = sha256(String(req.body.token));
  const passwordHash = await hashPassword(String(req.body.password));
  const now = new Date();
  await db.transaction(async tx => {
    const rows = await tx.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1).for('update');
    const record = rows[0];
    if (!record || record.usedAt || record.expiresAt <= now) throw unprocessable('El enlace de restablecimiento no es válido o ha caducado', 'RESET_TOKEN_INVALID');
    const activeUser = (await tx.select({ id: users.id }).from(users).where(and(eq(users.id, record.userId), isNull(users.deactivatedAt))).limit(1))[0];
    if (!activeUser) throw unprocessable('El enlace de restablecimiento no es válido o ha caducado', 'RESET_TOKEN_INVALID');
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.tokenHash, tokenHash));
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, record.userId));
    await tx.delete(sessions).where(eq(sessions.userId, record.userId));
    await auditEvent({ requestId: req.requestId, actorUserId: record.userId, action: 'auth.password_reset', resourceType: 'user', resourceId: record.userId }, tx);
  });
  res.status(204).end();
}));

authRouter.post('/change-password', requireAuth, validateBody(changePasswordSchema), asyncHandler(async (req, res) => {
  const user = (await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1))[0]!;
  if (!(await verifyPassword(user.passwordHash, String(req.body.currentPassword)))) throw unauthorized('La contraseña actual no es correcta');
  const newHash = await hashPassword(String(req.body.newPassword));
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));
  await db.delete(sessions).where(and(eq(sessions.userId, user.id))); // Require sign-in again on all devices.
  res.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions());
  await auditEvent({ requestId: req.requestId, actorUserId: user.id, action: 'auth.password_change', resourceType: 'user', resourceId: user.id });
  res.status(204).end();
}));

function isDuplicate(error: unknown) { return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY'; }
