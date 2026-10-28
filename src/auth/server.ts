import 'server-only';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

// Development-only until email verification, abuse controls and operational review exist.
const enabled = process.env.NODE_ENV === 'development' && process.env.OVERTO_AUTH_LOCAL === 'true' && !!process.env.OVERTO_DEV_DATABASE_URL && !!process.env.OVERTO_AUTH_SECRET;
export const pool = enabled ? new Pool({ connectionString: process.env.OVERTO_DEV_DATABASE_URL, max: 10 }) : null;
export const auth = pool ? betterAuth({
  database: pool,
  secret: process.env.OVERTO_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60 },
}) : null;
