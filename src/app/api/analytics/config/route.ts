import { analyticsEnvironment, posthogConfig } from '@/observability/config';

export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ ...posthogConfig(), environment: analyticsEnvironment() }, { headers: { 'Cache-Control': 'no-store' } });
}
