export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export const badRequest = (message: string, code = 'VALIDATION_ERROR', details?: Record<string, string[]>) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Debes iniciar sesión') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'No tienes permiso para realizar esta acción') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'No se encontró el recurso') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
export const unprocessable = (message: string, code = 'UNPROCESSABLE_ENTITY') => new AppError(422, code, message);
