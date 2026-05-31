'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/lib/useCurrentUser';
import type { Role } from '@/lib/roles';

export default function RequireRole({
  allow,
  children,
}: {
  allow: (role: Role) => boolean;
  children: React.ReactNode;
}) {
  const { user, loading } = useCurrentUser();
  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-blue-600 underline">sign in</Link>.
      </p>
    );
  }
  if (!allow(user.role)) {
    return <p className="py-8">You don&apos;t have access to this page.</p>;
  }
  return <>{children}</>;
}
