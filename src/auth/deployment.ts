/** A single validated seam for local experiments and opt-in self-hosted accounts. */
export type AccountDeployment = {
  mode: 'local' | 'selfhost';
  databaseUrl: string;
  authSecret: string;
  baseUrl: string;
  smtp: { host: string; port: number; secure: boolean; requireTLS: boolean; from: string; user?: string; pass?: string };
};

export function accountDeployment(env: NodeJS.ProcessEnv): AccountDeployment | null {
  if (env.NODE_ENV === 'development' && env.OVERTO_AUTH_LOCAL === 'true' && env.OVERTO_LOCAL_VERIFY_EMAIL === 'true' && env.OVERTO_DEV_DATABASE_URL && env.OVERTO_AUTH_SECRET) {
    const url = new URL(env.OVERTO_DEV_DATABASE_URL);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55443' || url.pathname !== '/overto') throw new Error('INVALID_LOCAL_DATABASE');
    return { mode: 'local', databaseUrl: env.OVERTO_DEV_DATABASE_URL, authSecret: env.OVERTO_AUTH_SECRET,
      baseUrl: env.BETTER_AUTH_URL || 'http://127.0.0.1:3005',
      smtp: { host: '127.0.0.1', port: 1025, secure: false, requireTLS: false, from: 'OvěřTo local <no-reply@example.test>' } };
  }
  if (env.OVERTO_SELF_HOSTED !== 'true') return null;
  if (env.NODE_ENV !== 'production' || env.OVERTO_AUTH_LOCAL === 'true' || !env.OVERTO_DATABASE_URL || !env.OVERTO_AUTH_SECRET || !env.BETTER_AUTH_URL || !env.SMTP_HOST || !env.SMTP_FROM) throw new Error('INVALID_SELFHOST_CONFIG');
  const database = new URL(env.OVERTO_DATABASE_URL);
  const origin = new URL(env.BETTER_AUTH_URL);
  const port = Number(env.SMTP_PORT || '587');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || !database.pathname || !database.username || !database.password ||
      (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && loopback)) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password ||
      !Number.isSafeInteger(port) || port < 1 || port > 65535 || env.OVERTO_AUTH_SECRET.length < 32 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.SMTP_FROM) || Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) throw new Error('INVALID_SELFHOST_CONFIG');
  return { mode: 'selfhost', databaseUrl: env.OVERTO_DATABASE_URL, authSecret: env.OVERTO_AUTH_SECRET,
    baseUrl: origin.origin,
    smtp: { host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === 'true', requireTLS: env.SMTP_REQUIRE_TLS !== 'false',
      from: env.SMTP_FROM, user: env.SMTP_USER || undefined, pass: env.SMTP_PASSWORD || undefined } };
}
