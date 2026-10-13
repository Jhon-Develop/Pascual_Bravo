import { describe, expect, it } from 'vitest';
import { registerSchema, resetPasswordSchema } from '@pazito/contracts';

describe('auth password policy', () => {
  it('rejects registration passwords shorter than 12 characters before sending the request', () => {
    expect(registerSchema.safeParse({ email: 'demo@example.com', name: 'Demo', password: 'Abcdefg1234' }).success).toBe(false);
  });

  it('accepts a valid registration password of 12 characters', () => {
    expect(registerSchema.safeParse({ email: 'demo@example.com', name: 'Demo', password: 'Abcdefg12345' }).success).toBe(true);
  });

  it('uses the same 12-character minimum for password reset', () => {
    expect(resetPasswordSchema.safeParse({ token: 't'.repeat(32), password: 'Abcdefg1234' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 't'.repeat(32), password: 'Abcdefg12345' }).success).toBe(true);
  });
});
