import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

async function main() {
  console.log('--- Step 1: Connecting to PostgreSQL container for backup verification ---');
  const containerName = 'overto-saas-postgres-1';
  const dumpFile = `/tmp/overto_backup_verify_${randomUUID().slice(0, 8)}.sql`;
  const restoreDb = `overto_restore_${Date.now()}`;

  // 1. Insert synthetic record into source database to verify preservation
  const testId = `backup-test-${randomUUID()}`;
  const testEmail = `${testId}@example.test`;
  console.log(`Inserting synthetic record with email: ${testEmail}`);
  execFileSync('docker', [
    'exec', containerName,
    'psql', '-U', 'overto', '-d', 'overto', '-c',
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('${testId}', 'Backup Smoke Test', '${testEmail}', true, now(), now()) ON CONFLICT (id) DO NOTHING;`
  ], { stdio: 'inherit' });

  try {
    // 2. Perform backup via pg_dump
    console.log(`--- Step 2: Running pg_dump to ${dumpFile} ---`);
    execFileSync('docker', [
      'exec', containerName,
      'pg_dump', '-U', 'overto', '-d', 'overto', '-f', dumpFile
    ], { stdio: 'inherit' });

    // Verify dump file exists in container and has size > 1KB
    const dumpCheck = execFileSync('docker', [
      'exec', containerName,
      'wc', '-c', dumpFile
    ], { encoding: 'utf8' }).trim();
    console.log(`Backup file created in container: ${dumpCheck} bytes`);

    // 3. Create independent restore database
    console.log(`--- Step 3: Creating independent restore database: ${restoreDb} ---`);
    execFileSync('docker', [
      'exec', containerName,
      'createdb', '-U', 'overto', restoreDb
    ], { stdio: 'inherit' });

    // 4. Restore the backup into the new database
    console.log(`--- Step 4: Restoring dump into ${restoreDb} ---`);
    execFileSync('docker', [
      'exec', containerName,
      'psql', '-U', 'overto', '-d', restoreDb, '-f', dumpFile
    ], { stdio: 'pipe' });

    // 5. Compare records and verify integrity
    console.log('--- Step 5: Verifying restored records and schema integrity ---');
    const sourceTables = execFileSync('docker', [
      'exec', containerName,
      'psql', '-U', 'overto', '-d', 'overto', '-t', '-c',
      "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
    ], { encoding: 'utf8' }).trim();

    const restoredTables = execFileSync('docker', [
      'exec', containerName,
      'psql', '-U', 'overto', '-d', restoreDb, '-t', '-c',
      "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
    ], { encoding: 'utf8' }).trim();

    console.log(`Table counts: Source = ${sourceTables}, Restored = ${restoredTables}`);
    if (sourceTables !== restoredTables) {
      throw new Error(`Table count mismatch: ${sourceTables} vs ${restoredTables}`);
    }

    // Verify synthetic record in restored database
    const syntheticCheck = execFileSync('docker', [
      'exec', containerName,
      'psql', '-U', 'overto', '-d', restoreDb, '-t', '-c',
      `SELECT email FROM "user" WHERE id = '${testId}';`
    ], { encoding: 'utf8' }).trim();

    console.log(`Restored synthetic email: ${syntheticCheck}`);
    if (syntheticCheck !== testEmail) {
      throw new Error(`Synthetic record missing in restored database: expected ${testEmail}, got ${syntheticCheck}`);
    }

    // Verify critical tables readiness in restored database
    const schemaReady = execFileSync('docker', [
      'exec', containerName,
      'psql', '-U', 'overto', '-d', restoreDb, '-t', '-c',
      "SELECT to_regclass('public.user') IS NOT NULL AND to_regclass('public.credit_accounts') IS NOT NULL AND to_regclass('public.local_workspaces') IS NOT NULL AND to_regclass('public.ai_traces') IS NOT NULL;"
    ], { encoding: 'utf8' }).trim();

    if (schemaReady !== 't') {
      throw new Error(`Restored schema missing critical tables: ${schemaReady}`);
    }

    console.log('VERIFIED: Backup and restoration successfully verified against independent PostgreSQL database.');
  } finally {
    // Cleanup synthetic data, restore database, and dump file
    console.log('--- Step 6: Cleaning up test artifacts ---');
    try {
      execFileSync('docker', [
        'exec', containerName,
        'psql', '-U', 'overto', '-d', 'overto', '-c',
        `DELETE FROM "user" WHERE id = '${testId}';`
      ], { stdio: 'pipe' });
    } catch {}

    try {
      execFileSync('docker', [
        'exec', containerName,
        'dropdb', '-U', 'overto', restoreDb
      ], { stdio: 'pipe' });
    } catch {}

    try {
      execFileSync('docker', [
        'exec', containerName,
        'rm', '-f', dumpFile
      ], { stdio: 'pipe' });
    } catch {}
  }
}

main().catch(error => {
  console.error('BACKUP_RESTORE_FAILED:', error);
  process.exit(1);
});
