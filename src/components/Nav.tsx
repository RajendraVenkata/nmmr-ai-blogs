'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'aws-amplify/auth';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useSearch } from '@/lib/SearchContext';
import { canAuthor, canGrantRoles } from '@/lib/roles';

export default function Nav() {
  const { user } = useCurrentUser();
  const { query, setQuery, open, setOpen } = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a] text-white">
      <nav className="mx-auto flex max-w-6xl items-center px-4 py-3">
        <div className="relative flex-1">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 text-sm"
            aria-label="Menu"
          >
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
              <span className="block h-0.5 w-5 bg-white" />
            </span>
            Menu
          </button>
          {menuOpen && (
            <div className="absolute left-0 mt-2 w-48 rounded bg-white py-2 text-sm text-gray-900 shadow-lg">
              <Link href="/" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Home</Link>
              {user && canAuthor(user.role) && (
                <Link href="/studio" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Studio</Link>
              )}
              {user && canGrantRoles(user.role) && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Admin</Link>
              )}
              {user && (
                <Link href="/account" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Account</Link>
              )}
              {user ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                >
                  Sign out
                </button>
              ) : (
                <Link href="/auth" onClick={() => setMenuOpen(false)} className="block px-4 py-2 hover:bg-gray-100">Sign in</Link>
              )}
            </div>
          )}
        </div>

        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="inline-block h-4 w-4 rounded-sm bg-brand" />
          MNNR AI Blogs
        </Link>

        <div className="flex flex-1 items-center justify-end gap-4">
          <button aria-label="Search" onClick={() => setOpen(!open)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
          {user ? (
            <Link href="/account" className="hidden text-sm sm:inline">{user.email || 'Account'}</Link>
          ) : (
            <Link href="/auth" className="text-sm">Sign in</Link>
          )}
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-[#0a0a0a]">
          <div className="mx-auto max-w-6xl px-4 py-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              className="w-full rounded bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>
      )}
    </header>
  );
}
