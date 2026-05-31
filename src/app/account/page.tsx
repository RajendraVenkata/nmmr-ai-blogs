'use client';

import { useCurrentUser } from '@/lib/useCurrentUser';
import Link from 'next/link';

export default function AccountPage() {
  const { user, loading } = useCurrentUser();
  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Your account</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p className="text-sm text-gray-500">
        Need writer access? Ask a system admin to grant it. (Self-service requests
        arrive in Phase 2.)
      </p>
      <p className="text-xs text-gray-400">Your user id: {user.userId}</p>
    </div>
  );
}
