'use client';

import Link from 'next/link';
import { signOut } from 'aws-amplify/auth';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canGrantRoles } from '@/lib/roles';

export default function Nav() {
  const { user } = useCurrentUser();
  return (
    <nav className="flex items-center gap-4 border-b px-4 py-3 text-sm">
      <Link href="/" className="font-semibold">MNNR AI Blogs</Link>
      <span className="flex-1" />
      {user && canAuthor(user.role) && <Link href="/studio">Studio</Link>}
      {user && canGrantRoles(user.role) && <Link href="/admin">Admin</Link>}
      {user ? (
        <>
          <Link href="/account">{user.email || 'Account'}</Link>
          <button onClick={() => signOut()} className="text-gray-600">Sign out</button>
        </>
      ) : (
        <Link href="/auth">Sign in</Link>
      )}
    </nav>
  );
}
