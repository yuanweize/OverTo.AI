import { NextResponse } from 'next/server';
export function GET() { return NextResponse.json({ status: 'ok', service: 'overto', schemaVersion: '1.0' }, { headers: { 'Cache-Control': 'no-store' } }); }
