import { NextRequest, NextResponse } from 'next/server';
import { getManageAuth } from '@/lib/manageAuth';
import { uploadToRag } from '@/lib/ragProxy';

export async function POST(request: NextRequest) {
  const auth = await getManageAuth(request);
  if (auth.status !== 200) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 });
  }

  const out = new FormData();
  out.append('file', file, file.name);
  const rag = await uploadToRag('/ingest/pdf', out);
  return NextResponse.json(rag.body, { status: rag.status });
}
