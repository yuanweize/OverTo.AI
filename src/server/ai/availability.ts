import 'server-only';
import { accountDeployment } from '@/auth/deployment';
import { pool } from '@/auth/server';
import { ProviderRepository } from '@/ai/providers/repository';
import { isAllowedProviderBaseUrl } from '@/ai/providers-config';
import { AiBudgetGuard } from './budgets';

/** UI hint only. Request admission and atomic reservation remain authoritative. */
export async function aiAvailableFor(account: boolean): Promise<boolean> {
  if (!pool || process.env.AI_ENABLED !== 'true' || !process.env.OPENAI_API_KEY || process.env.AI_EMERGENCY_DISABLE === 'true') return false;
  try {
    const deployment = accountDeployment(process.env);
    if (!deployment) return false;
    if (process.env.NODE_ENV === 'production') {
      if (process.env.AI_PRODUCTION_ENABLED !== 'true') return false;
      if (!account && process.env.AI_ANONYMOUS_ENABLED !== 'true') return false;
    } else if (process.env.AI_LOCAL_ONLY !== 'true') return false;
    const settings = (await new ProviderRepository(pool).read()).config;
    if (!settings.enabled || !settings.allowedModels.includes(settings.model) || !isAllowedProviderBaseUrl(settings.baseUrl)) return false;
    const price = await pool.query('SELECT 1 FROM ai_model_pricing WHERE model=$1 AND verified_at IS NOT NULL', [settings.model]);
    if (!price.rowCount) return false;
    return (await new AiBudgetGuard(pool).checkBudget()).allowed;
  } catch { return false; }
}
