import type { NextRequest } from 'next/server';

type AccountAnalysis = { workspaceId: string; projectId: string };
const accounts = new WeakMap<NextRequest, AccountAnalysis>();

/** Marks only an in-process request that has passed session/key and project checks. */
export function markAccountAnalysis(request: NextRequest, account: AccountAnalysis) {
  accounts.set(request, account);
  return request;
}

export function accountAnalysis(request: NextRequest): AccountAnalysis | undefined {
  return accounts.get(request);
}
