'use client';

import Link from 'next/link';

export default function AdminNav() {
  return (
    <nav className="mb-4 flex gap-4 border-b pb-2 text-sm">
      <Link href="/admin/requests" className="text-primary">Requests</Link>
      <Link href="/admin/posts" className="text-primary">Pending</Link>
      <Link href="/admin/users" className="text-primary">Users</Link>
      <Link href="/admin/moderation" className="text-primary">Moderation</Link>
      <Link href="/admin/containers" className="text-primary">Containers</Link>
    </nav>
  );
}
