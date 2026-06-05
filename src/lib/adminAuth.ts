import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/amplifyServer';
import { roleFromGroups, canGrantRoles } from '@/lib/roles';

export interface AdminAuth {
  status: number;
  token?: string;
  error?: string;
}

/** Read the Cognito session and return its ID token, only for SystemAdmins. */
export async function getAdminAuth(request: NextRequest): Promise<AdminAuth> {
  const response = NextResponse.next();
  const session = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: (contextSpec) => fetchAuthSession(contextSpec),
  }).catch(() => null);

  const idToken = session?.tokens?.idToken;
  if (!idToken) return { status: 401, error: 'Unauthenticated' };

  const groups = (idToken.payload?.['cognito:groups'] as string[] | undefined) ?? [];
  if (!canGrantRoles(roleFromGroups(groups))) return { status: 403, error: 'Admin access required' };

  return { status: 200, token: idToken.toString() };
}
