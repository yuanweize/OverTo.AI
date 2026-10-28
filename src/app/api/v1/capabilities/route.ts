import { NextResponse } from 'next/server';
export function GET() { return NextResponse.json({ schemaVersion: '1.0', inputs: ['text'], modes: ['rules', 'optional-ai'], targetUrlFetch: false, persistentAnalyses: false }, { headers: { 'Cache-Control': 'no-store' } }); }
