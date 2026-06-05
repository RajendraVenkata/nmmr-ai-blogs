import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { authorizeTerminalRequest } from '@/lib/terminalToken';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const labId: string | undefined = body?.labId;

  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const payload = session?.tokens?.idToken?.payload as Record<string, unknown> | undefined;
  const groups = (payload?.['cognito:groups'] as string[] | undefined) ?? [];

  const result = authorizeTerminalRequest({
    sub: payload?.sub as string | undefined,
    email: payload?.email as string | undefined,
    groups,
    labId,
    secret: process.env.TERMINAL_JWT_SECRET,
  });

  return NextResponse.json(result.body, { status: result.status });
}
