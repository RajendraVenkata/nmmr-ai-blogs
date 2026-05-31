'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { roleFromGroups, type Role } from '@/lib/roles';

export interface CurrentUser {
  userId: string;
  username: string;
  email: string;
  role: Role;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload ?? {};
      const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];
      const email = (payload.email as string | undefined) ?? '';
      setUser({
        userId: current.userId,
        username: current.username,
        email,
        role: roleFromGroups(groups),
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const stop = Hub.listen('auth', () => load());
    return () => stop();
  }, []);

  return { user, loading, reload: load };
}
