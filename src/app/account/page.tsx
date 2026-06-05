'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { client } from '@/lib/client';
import AccessRequestForm from '@/components/AccessRequestForm';
import MyRequests, { type RequestRow } from '@/components/MyRequests';
import MyContainers from '@/components/MyContainers';
import { pendingRequests } from '@/lib/access';

export default function AccountPage() {
  const { user, loading } = useCurrentUser();
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const loadRequests = useCallback(async () => {
    const { data } = await client.models.AccessRequest.list({});
    setRequests(data as RequestRow[]);
  }, []);

  useEffect(() => {
    if (user) loadRequests();
  }, [user?.userId, loadRequests]);

  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-primary underline">sign in</Link>.
      </p>
    );
  }

  const pendingRoles = pendingRequests(requests)
    .map((r) => r.requestedRole)
    .filter((r): r is string => !!r);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p className="text-xs text-gray-400">Your user id: {user.userId}</p>
      <AccessRequestForm user={user} pendingRoles={pendingRoles} onSubmitted={loadRequests} />
      <MyRequests requests={requests} />
      <MyContainers />
    </div>
  );
}
