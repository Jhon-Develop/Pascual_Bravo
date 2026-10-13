import { describe, expect, it } from 'vitest';
import { sealJson, unsealJson } from '../../src/shared/security/crypto.js';

describe('idempotency result encryption', () => {
  it('round-trips values without storing the plaintext response', () => {
    const sensitiveResponse = { invitationUrl: 'http://localhost:4321/join?token=very-secret', id: 'test' };
    const sealed = sealJson(sensitiveResponse) as Record<string, unknown>;
    expect(JSON.stringify(sealed)).not.toContain('very-secret');
    expect(unsealJson(sealed)).toEqual(sensitiveResponse);
  });
});
