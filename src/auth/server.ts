import 'server-only';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { accountDeployment } from './deployment';

const deployment = accountDeployment(process.env);
export const pool = deployment ? new Pool({ connectionString: deployment.databaseUrl, max: 10 }) : null;
const mail = deployment ? nodemailer.createTransport({
  host: deployment.smtp.host, port: deployment.smtp.port, secure: deployment.smtp.secure,
  requireTLS: deployment.smtp.requireTLS, connectionTimeout: 5000,
  ...(deployment.smtp.user ? { auth: { user: deployment.smtp.user, pass: deployment.smtp.pass } } : {}),
}) : null;
export const auth = pool ? betterAuth({
  database: pool,
  secret: deployment!.authSecret,
  baseURL: deployment!.baseUrl,
  ...(deployment!.mode === 'selfhost' ? { rateLimit: { enabled: true, storage: 'database' as const, window: 60, max: 60 } } : {}),
  emailAndPassword: {
    enabled: true, minPasswordLength: 10, maxPasswordLength: 128,
    requireEmailVerification: true, autoSignIn: false, revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await mail!.sendMail({ from: deployment!.smtp.from, to: user.email, subject: deployment!.mode === 'local' ? 'Obnovení hesla — místní test' : 'Obnovení hesla — OvěřTo.AI', text: `Pro nastavení nového hesla otevřete: ${url}` });
    },
  },
  emailVerification: {
    sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false, expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await mail!.sendMail({ from: deployment!.smtp.from, to: user.email, subject: deployment!.mode === 'local' ? 'Ověření e-mailu — místní test' : 'Ověření e-mailu — OvěřTo.AI', text: `Pro ověření e-mailu otevřete: ${url}` });
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
