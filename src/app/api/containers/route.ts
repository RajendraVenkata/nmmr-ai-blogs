import { NextRequest, NextResponse } from 'next/server';
import { getManageAuth } from '@/lib/manageAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function GET(request: NextRequest) {
  const auth = await getManageAuth(request);
  if (auth.status !== 200 || !auth.token) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/containers', { method: 'GET', token: auth.token });
  return NextResponse.json(relay.body, { status: relay.status });
}
