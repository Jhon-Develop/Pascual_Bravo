import type { User } from '@pazito/contracts';
declare global {
  namespace Express {
    interface Request { auth?: { userId: string; sessionHash: string; user: User; viaCookie: boolean }; requestId?: string; validatedQuery?: unknown; }
  }
}
export {};
