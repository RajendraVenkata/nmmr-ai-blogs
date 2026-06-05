import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/adminAuth';
import { proxyToRelay } from '@/lib/relayProxy';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const containerId: string | undefined = body?.containerId;

  const auth = await getAdminAuth(request);
  if (auth.status !== 200 || !auth.token) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const relay = await proxyToRelay('/api/admin/containers/stop', {
    method: 'POST',
    token: auth.token,
    body: { containerId },
  });
  return NextResponse.json(relay.body, { status: relay.status });
}
