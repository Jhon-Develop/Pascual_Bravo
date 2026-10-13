import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../client';

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves the /api/v1 prefix and encodes query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      getAccessToken: () => null,
      onUnauthorized: vi.fn(),
    });

    await api.getGroups({ page: 2, limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toBe('/api/v1/groups');
    expect(parsedUrl.searchParams.get('page')).toBe('2');
    expect(parsedUrl.searchParams.get('limit')).toBe('10');
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('sends a stable caller-supplied idempotency key for mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: 'group-test',
      name: 'Prueba',
      currency: 'COP',
      createdBy: 'user-test',
      createdAt: '2026-10-11T00:00:00.000Z',
      updatedAt: '2026-10-11T00:00:00.000Z',
      memberCount: 1,
      userRole: 'owner',
    }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const api = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      getAccessToken: () => 'test-access-token',
      onUnauthorized: vi.fn(),
    });

    await api.createGroup({ name: 'Prueba', currency: 'COP' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Idempotency-Key')).toBeTruthy();
    expect(headers.get('Authorization')).toBe('Bearer test-access-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
