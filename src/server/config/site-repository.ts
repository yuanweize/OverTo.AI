import type { Pool } from 'pg';
import { defaultSiteConfig, validateSiteConfig, type SiteConfig } from './site-schema';
export type SiteSnapshot = { version: number; config: SiteConfig };
export class SiteRepository {
  constructor(private readonly pool: Pool) {}
  async read(): Promise<SiteSnapshot> {
    const result = await this.pool.query('SELECT version,config FROM platform_site_settings WHERE id=1');
    if (!result.rowCount) throw new Error('SETTINGS_UNINITIALIZED');
    return { version: result.rows[0].version, config: validateSiteConfig(result.rows[0].config) };
  }
  async update(actorId: string, expectedVersion: number, input: unknown): Promise<SiteSnapshot> {
    const config = validateSiteConfig(input);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new Error('INVALID_VERSION');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const admin = await client.query('SELECT a.user_id FROM platform_admins a JOIN "user" u ON u.id=a.user_id WHERE a.user_id=$1 AND a.role=$2 AND u."emailVerified"=true FOR SHARE OF a,u', [actorId, 'ROOT']);
      if (!admin.rowCount) throw new Error('FORBIDDEN');
      const old = await client.query('SELECT config,version FROM platform_site_settings WHERE id=1 FOR UPDATE');
      if (!old.rowCount || old.rows[0].version !== expectedVersion) throw new Error('VERSION_CONFLICT');
      const version = expectedVersion + 1;
      await client.query('UPDATE platform_site_settings SET version=$1,config=$2,updated_at=now() WHERE id=1', [version, JSON.stringify(config)]);
      await client.query('INSERT INTO platform_settings_audit(actor_id,version,before_config,after_config) VALUES ($1,$2,$3,$4)', [actorId, version, JSON.stringify(old.rows[0].config), JSON.stringify(config)]);
      await client.query('COMMIT');
      return { version, config };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
export const defaultSiteSnapshot: SiteSnapshot = { version: 0, config: defaultSiteConfig };
