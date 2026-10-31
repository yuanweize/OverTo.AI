import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Known safe synthetic test strings or template tokens to ignore
const ALLOWED_MASKS = [
  'local-ci-password',
  'test-only-password',
  'ci-better-auth-secret',
  'local-ci-only-secret',
  'ci-identity-salt',
  'change_me_to_a_strong_random_secret',
  'POSTGRES_PASSWORD',
  'OVERTO_DB_PASSWORD',
  'test-password',
  'postgres',
  '<password>',
  'dummy',
  'placeholder',
  'example',
];

const SECRET_PATTERNS = [
  // Live Stripe keys (test mode sk_test is permitted in ignored files, live sk_live is forbidden everywhere)
  { name: 'Live Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Live Stripe Restricted Key', regex: /rk_live_[0-9a-zA-Z]{24,}/g },
  // Unencrypted private keys
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  // Hardcoded postgres passwords in code (must not match generic env placeholders)
  { name: 'Hardcoded PostgreSQL Credential in Source', regex: /postgresql:\/\/[^:]+:([^@/\s"']{8,})@/g },
  // Hardcoded AWS access keys
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
];

async function main() {
  console.log('Running secret scan on tracked repository files...');
  const trackedOutput = execSync('git ls-files', { encoding: 'utf8' });
  const files = trackedOutput.trim().split('\n').filter(Boolean);

  let violations = 0;

  for (const relPath of files) {
    // Ignore example envs and non-text files
    if (
      relPath === '.env.example' ||
      relPath === '.env.selfhost.example' ||
      relPath.endsWith('.png') ||
      relPath.endsWith('.svg') ||
      relPath.endsWith('.ico') ||
      relPath.endsWith('.dump') ||
      relPath.endsWith('.pdf') ||
      relPath.startsWith('assets/')
    ) {
      continue;
    }

    try {
      const content = await readFile(resolve(process.cwd(), relPath), 'utf8');

      for (const pattern of SECRET_PATTERNS) {
        const matches = [...content.matchAll(pattern.regex)];
        for (const match of matches) {
          const matchedSecret = match[1] || match[0];
          const isAllowed = ALLOWED_MASKS.some(mask => matchedSecret.includes(mask));
          if (!isAllowed) {
            console.error(`[SECRET SCAN FAILURE] ${relPath}: Detected potential ${pattern.name}`);
            violations++;
          }
        }
      }
    } catch {
      // Ignored non-text files
    }
  }

  if (violations > 0) {
    console.error(`\nSecret scan FAILED: ${violations} exposed credential(s) or private key(s) detected!`);
    process.exit(1);
  } else {
    console.log(`Secret scan PASSED: ${files.length} tracked files scanned. No exposed credentials detected.`);
  }
}

main().catch(err => {
  console.error('Secret scanner encountered an unhandled error:', err);
  process.exit(1);
});
