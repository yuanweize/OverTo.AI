// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/server', () => ({ pool: {} }));
vi.mock('@/server/config/admin', () => ({ getPlatformAdmin: async () => ({ id: 'synthetic-root' }) }));
vi.mock('@/server/security/origin', () => ({ isAllowedOrigin: () => true }));
vi.mock('server-only', () => ({}));

import { POST } from '@/app/api/admin/billing/plans/route';

describe('ROOT plan publish request validation', () => {
  const request = (body?: string) => new Request('http://127.0.0.1:3005/api/admin/billing/plans', {
    method: 'POST', headers: { origin: 'http://127.0.0.1:3005' }, ...(body === undefined ? {} : { body }),
  });

  it('reports malformed or missing JSON as client errors', async () => {
    expect((await POST(request('{'))).status).toBe(400);
    expect((await POST(request())).status).toBe(400);
  });

  it('rejects oversized bodies before parsing or database access', async () => {
    const response = await POST(request('x'.repeat(8193)));
    expect(response.status).toBe(413);
    expect((await response.json()).error).toBe('BODY_TOO_LARGE');
  });
});
