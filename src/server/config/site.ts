import 'server-only';
import { cache } from 'react';
import { pool } from '@/auth/server';
import { defaultSiteSnapshot, SiteRepository } from './site-repository';
// Request-scoped only: updates become visible on the next request on every replica.
export const getSiteSnapshot = cache(async () => pool ? new SiteRepository(pool).read() : defaultSiteSnapshot);
