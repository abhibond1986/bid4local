import { NextResponse } from 'next/server';

/**
 * Liveness/readiness probe. Returns 200 when the app is up. Does not touch the
 * database so it stays cheap; a deeper `?deep=1` check can be added later.
 */
export async function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'bid4local', time: new Date().toISOString() },
    { status: 200 },
  );
}
