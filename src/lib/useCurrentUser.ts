'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { roleFromGroups, type Role } from '@/lib/roles';
import { client } from '@/lib/client';

export interface CurrentUser {
  userId: string;
  username: string;
  email: string;
  role: Role;
}

async function ensureProfile(u: CurrentUser) {
  // Mirror the user's identity/role into UserProfile so admins can enumerate
  // users. Non-fatal: authorization still comes from Cognito groups.
  try {
    const { data: existing } = await client.models.UserProfile.get({ id: u.userId });
    if (!existing) {
      await client.models.UserProfile.create({
        id: u.userId,
        email: u.email,
        role: u.role,
        status: 'ACTIVE',
      });
    } else if (existing.role !== u.role) {
      await client.models.UserProfile.update({ id: u.userId, role: u.role });
    }
  } catch {
    // ignore — profile mirroring is best-effort
  }
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
      const next: CurrentUser = {
        userId: current.userId,
        username: current.username,
        email,
        role: roleFromGroups(groups),
      };
      setUser(next);
      void ensureProfile(next);
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
