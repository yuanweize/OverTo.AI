import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

/**
 * Extracts and privacy-hashes the client identifier.
 * Raw IP addresses are never logged or stored.
 */
export function extractClientIdentifier(request: NextRequest, salt = process.env.OVERTO_AUTH_SECRET || 'overto-default-salt'): string {
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const forwardedFor = request.headers.get('x-forwarded-for');

  let candidateIp = '';
  if (cfIp && isValidIp(cfIp)) {
    candidateIp = cfIp;
  } else if (realIp && isValidIp(realIp)) {
    candidateIp = realIp;
  } else if (forwardedFor) {
    // Leftmost entry in X-Forwarded-For is the original client IP
    const firstPart = forwardedFor.split(',')[0].trim();
    if (isValidIp(firstPart)) {
      candidateIp = firstPart;
    }
  }

  const raw = candidateIp || request.headers.get('user-agent') || 'anonymous-client';
  return createHash('sha256').update(`${salt}:${raw}`).digest('hex').slice(0, 32);
}

function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}
