import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('HTTP application shell', () => {
  it('exposes a process liveness check without requiring a database', async () => {
    const response = await request(app).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('exposes versioned health and the OpenAPI document', async () => {
    const health = await request(app).get('/api/v1/health/live');
    expect(health.status).toBe(200);
    const openapi = await request(app).get('/api/v1/openapi.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.openapi).toMatch(/^3\./);
    expect(openapi.body.paths['/auth/register']).toBeDefined();
  });

  it('returns a uniform JSON error for unknown API routes', async () => {
    const response = await request(app).get('/api/v1/no-such-route');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
    expect(response.body.requestId).toBeTruthy();
  });
});
