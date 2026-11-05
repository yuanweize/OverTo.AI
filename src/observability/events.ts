/** Only these low-cardinality, non-content fields may leave the application. */
export type AnalyticsEvent =
  | { event: '$pageview'; properties: { page: PageName; locale: 'cs' | 'en' } }
  | { event: 'overto.analysis_started'; properties: { engine: 'rules' | 'ai'; surface: 'public' | 'account' } }
  | { event: 'overto.analysis_completed'; properties: { engine: 'rules' | 'ai'; status: 'success' | 'fallback'; risk: 'HIGH_RISK' | 'VERIFICATION_RECOMMENDED' | 'INSUFFICIENT_EVIDENCE'; surface: 'public' | 'account' } }
  | { event: 'overto.analysis_failed'; properties: { engine: 'rules' | 'ai'; surface: 'public' | 'account'; category: 'network' | 'server' | 'unknown' } }
  | { event: 'overto.signup_completed'; properties: Record<string, never> }
  | { event: 'overto.login_completed'; properties: Record<string, never> }
  | { event: 'overto.checkout_started'; properties: { mode: 'test' } }
  | { event: 'overto.ai_call_completed'; properties: { status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'UNAVAILABLE'; reason: AiFailureCategory; duration_ms: number; input_tokens: number; output_tokens: number; estimated_cost_usd: number } };

export type PageName = 'home' | 'analyze' | 'login' | 'signup' | 'dashboard' | 'projects' | 'api_keys' | 'playground' | 'usage' | 'billing' | 'admin' | 'ai_studio' | 'docs' | 'other';
export type AiFailureCategory = 'none' | 'timeout' | 'rate_limit' | 'provider' | 'invalid_response' | 'budget' | 'disabled' | 'other';

export function pageName(path: string): PageName {
  if (path === '/') return 'home';
  if (path === '/analyze' || path === '/dashboard/analyze') return 'analyze';
  if (path === '/login') return 'login';
  if (path === '/signup') return 'signup';
  if (path.startsWith('/admin/ai-studio')) return 'ai_studio';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/dashboard/projects')) return 'projects';
  if (path.startsWith('/dashboard/api-keys')) return 'api_keys';
  if (path.startsWith('/dashboard/playground')) return 'playground';
  if (path.startsWith('/dashboard/usage')) return 'usage';
  if (path.startsWith('/dashboard/billing')) return 'billing';
  if (path.startsWith('/dashboard')) return 'dashboard';
  if (path === '/docs' || path === '/developers') return 'docs';
  return 'other';
}

const allowed: Record<AnalyticsEvent['event'], readonly string[]> = {
  $pageview: ['page', 'locale'], 'overto.analysis_started': ['engine', 'surface'],
  'overto.analysis_completed': ['engine', 'status', 'risk', 'surface'],
  'overto.analysis_failed': ['engine', 'surface', 'category'],
  'overto.signup_completed': [], 'overto.login_completed': [], 'overto.checkout_started': ['mode'],
  'overto.ai_call_completed': ['status', 'reason', 'duration_ms', 'input_tokens', 'output_tokens', 'estimated_cost_usd'],
};
const enumValues: Record<string, readonly string[]> = {
  page: ['home','analyze','login','signup','dashboard','projects','api_keys','playground','usage','billing','admin','ai_studio','docs','other'],
  locale: ['cs','en'], engine: ['rules','ai'], surface: ['public','account'],
  status: ['success','fallback','SUCCESS','FAILED','BLOCKED','UNAVAILABLE'],
  risk: ['HIGH_RISK','VERIFICATION_RECOMMENDED','INSUFFICIENT_EVIDENCE'], category: ['network','server','unknown'],
  mode: ['test'], reason: ['none','timeout','rate_limit','provider','invalid_response','budget','disabled','other'],
};

/** Projection is defensive even when a caller accidentally passes a message or URL. */
export function safeEvent(event: string, properties: Record<string, unknown>): { event: AnalyticsEvent['event']; properties: Record<string, string | number> } | null {
  if (!(event in allowed)) return null;
  const name = event as AnalyticsEvent['event'];
  const clean: Record<string, string | number> = {};
  for (const key of allowed[name]) {
    const value = properties[key];
    if (key in enumValues && typeof value === 'string' && enumValues[key].includes(value)) clean[key] = value;
    else if (!(key in enumValues) && typeof value === 'number' && Number.isFinite(value) && value >= 0) clean[key] = Math.min(value, 1_000_000);
    else return null;
  }
  return { event: name, properties: clean };
}
