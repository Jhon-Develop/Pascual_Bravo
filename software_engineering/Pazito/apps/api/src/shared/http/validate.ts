import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length ? issue.path.join('.') : 'body';
        (details[key] ??= []).push(issue.message);
      }
      return next(new AppError(400, 'VALIDATION_ERROR', 'Datos de entrada inválidos', details));
    }
    req.body = parsed.data;
    return next();
  };
}
export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (details[issue.path.join('.') || 'query'] ??= []).push(issue.message);
      return next(new AppError(400, 'VALIDATION_ERROR', 'Parámetros de consulta inválidos', details));
    }
    resAssign(req, 'validatedQuery', parsed.data);
    return next();
  };
}
function resAssign(req: object, key: string, value: unknown) { Object.defineProperty(req, key, { value, configurable: true, enumerable: false }); }
