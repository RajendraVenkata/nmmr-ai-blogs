import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { canUseContainers } from '@/lib/roles';

export interface ManageAuth {
  status: number;
  token?: string;
  error?: string;
}

/** Read the Cognito session and return its ID token (with a cheap Coder pre-check). */
export async function getManageAuth(request: NextRequest): Promise<ManageAuth> {
  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const idToken = session?.tokens?.idToken;
  if (!idToken) return { status: 401, error: 'Unauthenticated' };

  const groups = (idToken.payload?.['cognito:groups'] as string[] | undefined) ?? [];
  if (!canUseContainers(groups)) return { status: 403, error: 'Coder access required' };

  return { status: 200, token: idToken.toString() };
}
