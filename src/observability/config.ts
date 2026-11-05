export type PostHogConfig = { enabled: false } | { enabled: true; token: string; host: string };

export function analyticsEnvironment(env: NodeJS.ProcessEnv = process.env): 'production' | 'qa' | 'development' | 'test' {
  if (env.OVERTO_ANALYTICS_ENVIRONMENT === 'qa') return 'qa';
  return env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';
}

/** Runtime configuration lets one Docker image serve multiple self-hosted environments. */
export function posthogConfig(env: NodeJS.ProcessEnv = process.env): PostHogConfig {
  const token = env.POSTHOG_PROJECT_TOKEN || env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = env.POSTHOG_HOST || env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
  const localHost = /^http:\/\/(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(host);
  if (env.POSTHOG_ENABLED !== 'true' || !token || !/^phc_[a-zA-Z0-9]+$/.test(token) ||
      (host !== 'https://eu.i.posthog.com' && !(env.NODE_ENV !== 'production' && localHost))) return { enabled: false };
  return { enabled: true, token, host };
}
