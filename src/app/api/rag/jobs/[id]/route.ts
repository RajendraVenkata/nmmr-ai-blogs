import { NextRequest, NextResponse } from 'next/server';
import { getManageAuth } from '@/lib/manageAuth';
import { getFromRag } from '@/lib/ragProxy';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getManageAuth(request);
  if (auth.status !== 200) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const rag = await getFromRag(`/jobs/${encodeURIComponent(params.id)}`);
  return NextResponse.json(rag.body, { status: rag.status });
}
