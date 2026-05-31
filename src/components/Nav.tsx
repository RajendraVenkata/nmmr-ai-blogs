'use client';

import Link from 'next/link';
import { signOut } from 'aws-amplify/auth';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canGrantRoles } from '@/lib/roles';

export default function Nav() {
  const { user } = useCurrentUser();
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-gray-900">NMMR AI Blogs</Link>
          <Link href="/" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Home</Link>
          {user && canAuthor(user.role) && (
            <Link href="/studio" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Studio</Link>
          )}
          {user && canGrantRoles(user.role) && (
            <Link href="/admin" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:inline">Admin</Link>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/account" className="text-gray-600 hover:text-gray-900">{user.name}</Link>
              <button onClick={() => signOut()} className="text-gray-600 hover:text-gray-900">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
              <Link href="/register" className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primaryDark">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
