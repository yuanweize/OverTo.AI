import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { accountDeployment } from '../deployment';
import { getMigrationCredentials } from '../../../scripts/migrate-selfhost';
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

      // 9. Database plan must use valid modern plan (free or flexible), not legacy 'starter'
      expect(yamlContent).not.toMatch(/databases:[\s\S]*?plan:\s*starter/);
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

    it('automatically uses RENDER_EXTERNAL_URL if BETTER_AUTH_URL is omitted', () => {
      const withoutBetterAuthUrl = { ...validRenderEnv };
      delete withoutBetterAuthUrl.BETTER_AUTH_URL;
      withoutBetterAuthUrl.RENDER_EXTERNAL_URL = 'https://overto-ai-demo.onrender.com';

      const deployment = accountDeployment(withoutBetterAuthUrl);
      expect(deployment?.baseUrl).toBe('https://overto-ai-demo.onrender.com');
    });

    it('accepts both RFC 5322 display name with angle brackets and plain email in SMTP_FROM', () => {
      const withDisplayName = { ...validRenderEnv, SMTP_FROM: 'OvěřTo.AI <noreply@overto.ai>' };
      const deployment = accountDeployment(withDisplayName);
      expect(deployment?.smtp.from).toBe('OvěřTo.AI <noreply@overto.ai>');
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

  describe('Pre-Deploy Migration Isolation (getMigrationCredentials)', () => {
    it('successfully extracts database credentials during Render pre-deploy before SMTP is configured', () => {
      // Exactly the environment present when Render initially provisions Blueprint
      const renderPreDeployEnv: NodeJS.ProcessEnv = {
        NODE_ENV: 'production',
        OVERTO_SELF_HOSTED: 'true',
        OVERTO_AUTH_LOCAL: 'false',
        OVERTO_DATABASE_URL: 'postgresql://overto:test-password@10.0.0.1:5432/overto',
        OVERTO_AUTH_SECRET: 'generated-render-secret-at-least-32-chars-long',
        // SMTP and BETTER_AUTH_URL are NOT yet provided by user
      };

      const credentials = getMigrationCredentials(renderPreDeployEnv);
      expect(credentials.databaseUrl).toBe('postgresql://overto:test-password@10.0.0.1:5432/overto');
      expect(credentials.authSecret).toBe('generated-render-secret-at-least-32-chars-long');
    });

    it('accepts DATABASE_URL as fallback if OVERTO_DATABASE_URL is not set', () => {
      const envWithDefaultDb: NodeJS.ProcessEnv = {
        NODE_ENV: 'production',
        OVERTO_SELF_HOSTED: 'true',
        OVERTO_AUTH_LOCAL: 'false',
        DATABASE_URL: 'postgresql://overto:secret@postgres.render.com:5432/overto',
        OVERTO_AUTH_SECRET: 'generated-render-secret-at-least-32-chars-long',
      };

      const credentials = getMigrationCredentials(envWithDefaultDb);
      expect(credentials.databaseUrl).toBe('postgresql://overto:secret@postgres.render.com:5432/overto');
    });

    it('rejects pre-deploy migration if not self-hosted or production', () => {
      expect(() => {
        getMigrationCredentials({
          NODE_ENV: 'development',
          OVERTO_SELF_HOSTED: 'false',
          OVERTO_DATABASE_URL: 'postgresql://overto:pass@localhost:5432/overto',
          OVERTO_AUTH_SECRET: 'secret-with-length-exceeding-thirty-two-chars',
        });
      }).toThrow('SELFHOST_CONFIG_REQUIRED');
    });

    it('rejects pre-deploy migration if OVERTO_AUTH_LOCAL=true in production', () => {
      expect(() => {
        getMigrationCredentials({
          NODE_ENV: 'production',
          OVERTO_SELF_HOSTED: 'true',
          OVERTO_AUTH_LOCAL: 'true',
          OVERTO_DATABASE_URL: 'postgresql://overto:pass@localhost:5432/overto',
          OVERTO_AUTH_SECRET: 'secret-with-length-exceeding-thirty-two-chars',
        });
      }).toThrow('INVALID_SELFHOST_CONFIG');
    });

    it('rejects pre-deploy migration if database URL is missing', () => {
      expect(() => {
        getMigrationCredentials({
          NODE_ENV: 'production',
          OVERTO_SELF_HOSTED: 'true',
          OVERTO_AUTH_LOCAL: 'false',
          OVERTO_AUTH_SECRET: 'secret-with-length-exceeding-thirty-two-chars',
        });
      }).toThrow('DATABASE_URL_REQUIRED');
    });

    it('rejects pre-deploy migration if auth secret is shorter than 32 chars', () => {
      expect(() => {
        getMigrationCredentials({
          NODE_ENV: 'production',
          OVERTO_SELF_HOSTED: 'true',
          OVERTO_AUTH_LOCAL: 'false',
          OVERTO_DATABASE_URL: 'postgresql://overto:pass@localhost:5432/overto',
          OVERTO_AUTH_SECRET: 'short',
        });
      }).toThrow('AUTH_SECRET_REQUIRED');
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
