import { NextRequest, NextResponse } from 'next/server';
import { mintManageToken } from '@/lib/manageAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const containerId: string | undefined = body?.containerId;

  const auth = await mintManageToken(request);
  if (auth.status !== 200 || !auth.body.token) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/containers/stop', {
    method: 'POST',
    token: auth.body.token,
    body: { containerId },
  });
  return NextResponse.json(relay.body, { status: relay.status });
}
