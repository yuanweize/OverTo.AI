import 'server-only';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';

// Local capture only. Production auth stays disabled until operational review.
const enabled = process.env.NODE_ENV === 'development' && process.env.OVERTO_AUTH_LOCAL === 'true' && process.env.OVERTO_LOCAL_VERIFY_EMAIL === 'true' && !!process.env.OVERTO_DEV_DATABASE_URL && !!process.env.OVERTO_AUTH_SECRET;
export const pool = enabled ? new Pool({ connectionString: process.env.OVERTO_DEV_DATABASE_URL, max: 10 }) : null;
const mail = nodemailer.createTransport({ host: '127.0.0.1', port: 1025, secure: false, connectionTimeout: 5000 });
export const auth = pool ? betterAuth({
  database: pool,
  secret: process.env.OVERTO_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true, minPasswordLength: 10, maxPasswordLength: 128,
    requireEmailVerification: true, autoSignIn: false, revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await mail.sendMail({ from: 'OvěřTo local <no-reply@example.test>', to: user.email, subject: 'Obnovení hesla — místní test', text: `Místní test. Pro nastavení hesla otevřete: ${url}` });
    },
  },
  emailVerification: {
    sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false, expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await mail.sendMail({ from: 'OvěřTo local <no-reply@example.test>', to: user.email, subject: 'Ověření e-mailu — místní test', text: `Místní test. Pro ověření e-mailu otevřete: ${url}` });
    },
  },
  databaseHooks: {
    user: {
      create: { before: async (user) => {
        const name = user.name.trim();
        return name.length > 0 && name.length <= 100 ? { data: { ...user, name } } : false;
      } },
      update: { before: async (user) => {
        if (user.name === undefined) return;
        if (typeof user.name !== 'string') return false;
        const name = user.name.trim();
        return name.length > 0 && name.length <= 100 ? { data: { ...user, name } } : false;
      } },
    },
  },
  session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60 },
}) : null;
