import type { Pool } from 'pg';
export interface RateLimitPolicy { bucket: string; limit: number; windowSeconds: number }
export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };
/** PostgreSQL-backed fixed windows. All scopes consume together or none do. */
export class SharedRateLimiter {
  constructor(private readonly pool: Pool) {}
  async consume(policies: RateLimitPolicy[]): Promise<RateLimitResult> {
    if (!policies.length || policies.length > 8 || new Set(policies.map(p => p.bucket)).size !== policies.length || policies.some(p => !/^[a-z0-9:_-]{1,180}$/i.test(p.bucket) || !Number.isSafeInteger(p.limit) || p.limit < 1 || p.limit > 1000000 || !Number.isSafeInteger(p.windowSeconds) || p.windowSeconds < 1 || p.windowSeconds > 86400)) throw new Error('INVALID_RATE_POLICY');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='2000ms'");
      const now = Number((await client.query('SELECT floor(extract(epoch FROM clock_timestamp()))::bigint AS seconds')).rows[0].seconds);
      // Stable lock ordering prevents opposing multi-scope requests deadlocking.
      for (const policy of [...policies].sort((a,b) => a.bucket.localeCompare(b.bucket))) {
        const start = Math.floor(now / policy.windowSeconds) * policy.windowSeconds;
        const result = await client.query(`INSERT INTO shared_rate_limits(bucket,window_start,requests,expires_at)
          VALUES($1,$2,1,to_timestamp($3)) ON CONFLICT(bucket,window_start)
          DO UPDATE SET requests=shared_rate_limits.requests+1 WHERE shared_rate_limits.requests < $4
          RETURNING requests`, [policy.bucket,start,start+policy.windowSeconds,policy.limit]);
        if (!result.rowCount) {
          await client.query('ROLLBACK');
          return { allowed: false, retryAfter: Math.max(1,start+policy.windowSeconds-now) };
        }
      }
      await client.query('COMMIT');
      return { allowed: true };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async prune(): Promise<number> {
    const result = await this.pool.query('DELETE FROM shared_rate_limits WHERE expires_at < now() - interval \'1 hour\'');
    return result.rowCount ?? 0;
  }
}
