# Next actions — official release checklist

All development gates (A through H) have been implemented and verified in this worktree.

## Verification Checklist

1. **Unit & Integration Suite**: 147 passed across 35 files against disposable PostgreSQL (`overto_test`).
2. **Type Safety & Lint**: `tsc --noEmit` passed with 0 errors, `eslint` passed with 0 errors and 0 warnings.
3. **Documentation**: `npm run docs:check` passed with 40 files, 153 local links, 0 failures.
4. **Production Build**: `npm run build` compiled 54 routes successfully.
5. **Self-Host Docker E2E**: `e2e/selfhost.e2e.ts` passed on live Docker Compose stack at `127.0.0.1:3006`.
6. **Backup & Restore**: `scripts/test-backup-restore.ts` passed with table parity and synthetic record verification.
7. **Prompt Lab Chain**: `src/server/ai/__tests__/prompt-activation-chain.integration.test.ts` passed (create, test, activate, execute, trace, rollback).
8. **Git Safety & Clean Public History**:
   - Inspect git status, diff, and secret scan.
   - Commit cleanly to `release/overto-7`.
   - Push `release/overto-7` to `origin`.
   - Create Pull Request into `main`.
   - Merge `main`.
   - Publish release tag and GitHub release.
