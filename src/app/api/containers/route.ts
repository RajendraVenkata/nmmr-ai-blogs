import { NextRequest, NextResponse } from 'next/server';
import { mintManageToken } from '@/lib/manageAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function GET(request: NextRequest) {
  const auth = await mintManageToken(request);
  if (auth.status !== 200 || !auth.body.token) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/containers', { method: 'GET', token: auth.body.token });
  return NextResponse.json(relay.body, { status: relay.status });
}
