import { describe, expect, it } from 'vitest';
import { accountDeployment } from '../deployment';

const selfhost = {
  NODE_ENV: 'production', OVERTO_SELF_HOSTED: 'true',
  OVERTO_DATABASE_URL: 'postgresql://app:test-password@postgres:5432/overto',
  OVERTO_AUTH_SECRET: 'a'.repeat(48), BETTER_AUTH_URL: 'https://verify.example.org',
  SMTP_HOST: 'smtp.example.org', SMTP_PORT: '587', SMTP_FROM: 'no-reply@example.org',
} as NodeJS.ProcessEnv;

describe('account deployment guard', () => {
  it('keeps production accounts closed without explicit self-host configuration', () => {
    expect(accountDeployment({ NODE_ENV: 'production', OVERTO_AUTH_LOCAL: 'true' })).toBeNull();
  });
  it('accepts a complete self-hosted database and SMTP configuration', () => {
    expect(accountDeployment(selfhost)).toMatchObject({ mode: 'selfhost', baseUrl: 'https://verify.example.org', smtp: { requireTLS: true } });
  });
  it('refuses insecure public origins, short secrets and incomplete SMTP credentials', () => {
    expect(() => accountDeployment({ ...selfhost, BETTER_AUTH_URL: 'http://verify.example.org' })).toThrow('INVALID_SELFHOST_CONFIG');
    expect(() => accountDeployment({ ...selfhost, OVERTO_AUTH_SECRET: 'short' })).toThrow('INVALID_SELFHOST_CONFIG');
    expect(() => accountDeployment({ ...selfhost, SMTP_USER: 'mailer' })).toThrow('INVALID_SELFHOST_CONFIG');
  });
  it('preserves the dedicated local database boundary', () => {
    expect(accountDeployment({ NODE_ENV: 'development', OVERTO_AUTH_LOCAL: 'true', OVERTO_LOCAL_VERIFY_EMAIL: 'true',
      OVERTO_DEV_DATABASE_URL: 'postgresql://tester:pass@127.0.0.1:55443/overto', OVERTO_AUTH_SECRET: 'local-secret' })).toMatchObject({ mode: 'local' });
    expect(() => accountDeployment({ NODE_ENV: 'development', OVERTO_AUTH_LOCAL: 'true', OVERTO_LOCAL_VERIFY_EMAIL: 'true',
      OVERTO_DEV_DATABASE_URL: 'postgresql://tester:pass@127.0.0.1:5432/overto', OVERTO_AUTH_SECRET: 'local-secret' })).toThrow('INVALID_LOCAL_DATABASE');
  });
});
