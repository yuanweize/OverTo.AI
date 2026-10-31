import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

export interface ClientIdentityOptions {
  salt?: string;
  peerIp?: string;
  trustedProxies?: string[];
  trustProxy?: boolean;
}

/**
 * Checks if an IP is a standard loopback address.
 */
function isLoopback(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

/**
 * Checks if an IP matches a trusted proxy list or keyword.
 */
function isTrustedProxy(ip: string, trustedProxies: string[]): boolean {
  if (!ip) return false;
  const clean = ip.trim().toLowerCase();
  for (const pattern of trustedProxies) {
    const pat = pattern.trim().toLowerCase();
    if (pat === 'loopback' && isLoopback(clean)) return true;
    if (pat === clean) return true;
    // Private Docker / LAN subnet matching: 10.x, 172.16-31.x, 192.168.x
    if (pat === 'private' || pat === 'lan') {
      if (clean.startsWith('10.') || clean.startsWith('192.168.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) {
        return true;
      }
    }
  }
  return false;
}

export function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

/**
 * Resolves the configured salt. Refuses hardcoded defaults in production.
 */
export function getClientIdentitySalt(customSalt?: string): string {
  if (customSalt) return customSalt;
  const configured = process.env.OVERTO_RATE_LIMIT_SALT || process.env.OVERTO_AUTH_SECRET;
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('OVERTO_RATE_LIMIT_SALT or OVERTO_AUTH_SECRET must be configured in production');
  }

  return 'dev-test-only-identity-salt';
}

/**
 * Extracts and privacy-hashes the client identifier under an explicit trusted proxy boundary.
 *
 * Direct requests to the application MUST NOT be allowed to spoof headers (CF-Connecting-IP,
 * X-Forwarded-For, X-Real-IP) to bypass client rate limits.
 *
 * User-Agents are NEVER used as independent identity entropy, preventing spoofing by UA rotation.
 */
export function extractClientIdentifier(
  request: Request | NextRequest,
  options?: ClientIdentityOptions
): string {
  const salt = getClientIdentitySalt(options?.salt);

  // Determine whether proxy headers should be trusted
  const trustProxyEnv = process.env.OVERTO_TRUST_PROXY === 'true';
  const trustProxy = options?.trustProxy ?? trustProxyEnv;
  const trustedProxiesEnv = (process.env.OVERTO_TRUSTED_PROXIES || 'loopback,private')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const trustedProxies = options?.trustedProxies ?? trustedProxiesEnv;

  // Next.js provides peer socket IP via request.ip or options.peerIp
  const socketIp = options?.peerIp || ('ip' in request && typeof request.ip === 'string' ? request.ip : '');
  const proxySecret = process.env.OVERTO_TRUSTED_PROXY_SECRET?.trim();
  const hasValidProxySecret = Boolean(proxySecret && request.headers.get('x-overto-proxy-secret') === proxySecret);

  let candidateIp = '';

  if (trustProxy) {
    // A peer is trusted ONLY when its socket IP matches the trusted proxies whitelist,
    // OR when a cryptographically verified upstream proxy secret is presented.
    // If socket IP is missing/unverifiable and no secret is provided, the peer is NEVER trusted.
    const peerIsTrusted = (socketIp ? isTrustedProxy(socketIp, trustedProxies) : false) || hasValidProxySecret;

    if (peerIsTrusted) {
      // 1. Cloudflare Connecting IP (if behind trusted Cloudflare boundary)
      const cfIp = request.headers.get('cf-connecting-ip')?.trim();
      if (cfIp && isValidIp(cfIp)) {
        candidateIp = cfIp;
      }

      // 2. X-Real-IP
      if (!candidateIp) {
        const realIp = request.headers.get('x-real-ip')?.trim();
        if (realIp && isValidIp(realIp)) {
          candidateIp = realIp;
        }
      }

      // 3. X-Forwarded-For: leftmost client IP from sanitized proxy chain
      if (!candidateIp) {
        const forwardedFor = request.headers.get('x-forwarded-for');
        if (forwardedFor) {
          const parts = forwardedFor.split(',').map(s => s.trim()).filter(isValidIp);
          if (parts.length > 0) {
            candidateIp = parts[0];
          }
        }
      }
    }
  }

  // If proxy headers are not trusted or no valid IP was discovered, fall back to socket IP
  if (!candidateIp && socketIp && isValidIp(socketIp)) {
    candidateIp = socketIp;
  }

  // Safe fallback for untrusted/unknown clients:
  // All untrusted direct requests without trusted proxy boundary share a unified bucket,
  // preventing attackers from rotating arbitrary headers to forge new quotas.
  const rawIdentifier = candidateIp || 'direct-untrusted-client';

  return createHash('sha256').update(`${salt}:${rawIdentifier}`).digest('hex').slice(0, 32);
}
