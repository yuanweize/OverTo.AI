/**
 * Validates that an incoming request Origin matches the canonical origin,
 * with loopback equivalence (localhost <-> 127.0.0.1 <-> [::1] on the same port)
 * for local development and self-hosted environments.
 */
export function isAllowedOrigin(
  requestOrigin: string | null,
  configuredUrl?: string
): boolean {
  if (!requestOrigin) return false;
  const canonical =
    configuredUrl ||
    process.env.OVERTO_PUBLIC_URL ||
    process.env.BETTER_AUTH_URL;
  if (!canonical) return false;

  try {
    const reqUrl = new URL(requestOrigin);
    const canUrl = new URL(canonical);

    // Exact origin match (protocol + host + port)
    if (reqUrl.origin === canUrl.origin) return true;

    // Loopback equivalence (e.g. localhost:3006 vs 127.0.0.1:3006)
    const isLoopback = (host: string) =>
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '0.0.0.0';

    if (
      reqUrl.protocol === canUrl.protocol &&
      reqUrl.port === canUrl.port &&
      isLoopback(reqUrl.hostname) &&
      isLoopback(canUrl.hostname)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

