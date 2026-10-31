import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { accountDeployment } from '../deployment';
import { GET as healthGet } from '@/app/api/v1/health/route';

describe('Production & Render Deployment Configuration Integrity', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('render.yaml Blueprint Syntax & Invariants', () => {
    it('enforces verified checksPass trigger, pre-deploy migration, and proper env keys', async () => {
      const yamlContent = await readFile('render.yaml', 'utf8');

      // 1. autoDeployTrigger must be checksPass, autoDeploy: true is rejected
      expect(yamlContent).toMatch(/autoDeployTrigger:\s*checksPass/);
      expect(yamlContent).not.toMatch(/autoDeploy:\s*true/);

      // 2. Pre-deploy migration must execute compiled script
      expect(yamlContent).toMatch(/preDeployCommand:\s*node scripts\/migrate\.cjs/);

      // 3. Health check path must point to /api/v1/health
      expect(yamlContent).toMatch(/healthCheckPath:\s*\/api\/v1\/health/);

      // 4. Must use OVERTO_SELF_HOSTED, NOT OVERTO_SELF_HOST
      expect(yamlContent).toMatch(/key:\s*OVERTO_SELF_HOSTED\s*\n\s*value:\s*'true'/);
      expect(yamlContent).not.toMatch(/key:\s*OVERTO_SELF_HOST\s*\n/);

      // 5. OVERTO_AUTH_LOCAL must be 'false', never 'true' in production
      expect(yamlContent).toMatch(/key:\s*OVERTO_AUTH_LOCAL\s*\n\s*value:\s*'false'/);
      expect(yamlContent).not.toMatch(/key:\s*OVERTO_AUTH_LOCAL\s*\n\s*value:\s*'true'/);

      // 6. Must use canonical SMTP_* env keys, NOT OVERTO_SMTP_*
      expect(yamlContent).toMatch(/key:\s*SMTP_HOST/);
      expect(yamlContent).toMatch(/key:\s*SMTP_PORT/);
      expect(yamlContent).toMatch(/key:\s*SMTP_USER/);
      expect(yamlContent).toMatch(/key:\s*SMTP_PASSWORD/);
      expect(yamlContent).toMatch(/key:\s*SMTP_FROM/);
      expect(yamlContent).not.toMatch(/key:\s*OVERTO_SMTP_/);

      // 7. Safety in public demo: Paid AI and Stripe billing disabled
      expect(yamlContent).toMatch(/key:\s*AI_ENABLED\s*\n\s*value:\s*'false'/);
      expect(yamlContent).toMatch(/key:\s*AI_LOCAL_ONLY\s*\n\s*value:\s*'false'/);
      expect(yamlContent).toMatch(/key:\s*STRIPE_SECRET_KEY\s*\n\s*value:\s*''/);

      // 8. Generated secrets for session security and client identity
      expect(yamlContent).toMatch(/key:\s*OVERTO_AUTH_SECRET\s*\n\s*generateValue:\s*true/);
      expect(yamlContent).toMatch(/key:\s*OVERTO_CLIENT_IDENTITY_SALT\s*\n\s*generateValue:\s*true/);
    });
  });

  describe('accountDeployment validation with Render production variables', () => {
    const validRenderEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      OVERTO_SELF_HOSTED: 'true',
      OVERTO_AUTH_LOCAL: 'false',
      OVERTO_REQUIRE_AUTH: 'true',
      OVERTO_DATABASE_URL: 'postgresql://overto:test-password@10.0.0.1:5432/overto',
      OVERTO_AUTH_SECRET: 'production-secret-at-least-32-chars-long-example',
      BETTER_AUTH_URL: 'https://demo.overto.ai',
      SMTP_HOST: 'smtp.resend.com',
      SMTP_PORT: '587',
      SMTP_USER: 'resend',
      SMTP_PASSWORD: 'test-password',
      SMTP_FROM: 'noreply@overto.ai',
      SMTP_SECURE: 'false',
      SMTP_REQUIRE_TLS: 'true',
    };

    it('successfully validates Render production environment', () => {
      const deployment = accountDeployment(validRenderEnv);
      expect(deployment).not.toBeNull();
      expect(deployment?.mode).toBe('selfhost');
      expect(deployment?.baseUrl).toBe('https://demo.overto.ai');
      expect(deployment?.smtp.host).toBe('smtp.resend.com');
      expect(deployment?.smtp.port).toBe(587);
      expect(deployment?.smtp.from).toBe('noreply@overto.ai');
    });

    it('rejects OVERTO_AUTH_LOCAL=true in production', () => {
      expect(() => {
        accountDeployment({ ...validRenderEnv, OVERTO_AUTH_LOCAL: 'true' });
      }).toThrow('INVALID_SELFHOST_CONFIG');
    });

    it('returns null if OVERTO_SELF_HOSTED is missing or typo OVERTO_SELF_HOST is used', () => {
      const withoutSelfHosted = { ...validRenderEnv };
      delete withoutSelfHosted.OVERTO_SELF_HOSTED;
      expect(accountDeployment({ ...withoutSelfHosted, OVERTO_SELF_HOST: 'true' })).toBeNull();
    });

    it('rejects if legacy OVERTO_SMTP_HOST is used instead of SMTP_HOST', () => {
      const withoutSmtpHost = { ...validRenderEnv };
      delete withoutSmtpHost.SMTP_HOST;
      expect(() => {
        accountDeployment({ ...withoutSmtpHost, OVERTO_SMTP_HOST: 'smtp.resend.com' });
      }).toThrow('INVALID_SELFHOST_CONFIG');
    });

    it('rejects if database URL is missing password or not postgres', () => {
      expect(() => {
        accountDeployment({ ...validRenderEnv, OVERTO_DATABASE_URL: 'postgresql://overto@10.0.0.1:5432/overto' });
      }).toThrow('INVALID_SELFHOST_CONFIG');
    });
  });

  describe('/api/v1/health false-positive prevention', () => {
    it('returns HTTP 503 when OVERTO_SELF_HOST typo is detected', async () => {
      vi.stubEnv('OVERTO_SELF_HOST', 'true');
      vi.stubEnv('OVERTO_SELF_HOSTED', 'false');

      const response = await healthGet();
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.status).toBe('unavailable');
      expect(data.error).toBe('MISCONFIGURED_ENV_USE_OVERTO_SELF_HOSTED');
    });

    it('returns HTTP 503 when OVERTO_REQUIRE_AUTH is set but auth config is invalid', async () => {
      vi.stubEnv('OVERTO_REQUIRE_AUTH', 'true');
      vi.stubEnv('OVERTO_AUTH_LOCAL', 'true');
      vi.stubEnv('NODE_ENV', 'production');

      const response = await healthGet();
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.status).toBe('unavailable');
    });

    it('returns HTTP 503 when OVERTO_SELF_HOSTED=true but auth is disabled/null', async () => {
      vi.stubEnv('OVERTO_SELF_HOSTED', 'true');
      vi.stubEnv('NODE_ENV', 'development'); // fails selfhost check (requires production)

      const response = await healthGet();
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.status).toBe('unavailable');
    });
  });
});
