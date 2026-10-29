import { getSiteSnapshot } from '@/server/config/site';
export async function GET() {
  try { return Response.json(await getSiteSnapshot(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'CONFIG_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
