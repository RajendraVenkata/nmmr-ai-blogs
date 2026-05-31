'use client';

import Link from 'next/link';

export default function AdminNav() {
  return (
    <nav className="mb-4 flex gap-4 border-b pb-2 text-sm">
      <Link href="/admin/requests" className="text-blue-600">Requests</Link>
      <Link href="/admin/users" className="text-blue-600">Users</Link>
      <Link href="/admin/moderation" className="text-blue-600">Moderation</Link>
    </nav>
  );
}
