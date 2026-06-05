import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { authorizeManageRequest, type TerminalAuthResult } from '@/lib/terminalToken';

/** Read the Cognito session for this request and mint a relay management token. */
export async function mintManageToken(request: NextRequest): Promise<TerminalAuthResult> {
  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const payload = session?.tokens?.idToken?.payload as Record<string, unknown> | undefined;
  const groups = (payload?.['cognito:groups'] as string[] | undefined) ?? [];

  return authorizeManageRequest({
    sub: payload?.sub as string | undefined,
    email: payload?.email as string | undefined,
    groups,
    secret: process.env.TERMINAL_JWT_SECRET,
  });
}
