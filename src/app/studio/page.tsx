'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RequireRole from '@/components/RequireRole';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canModerate, canEditPost } from '@/lib/roles';
import { notDeleted } from '@/lib/posts';

interface PostRow {
  id: string;
  title: string;
  slug: string;
  status?: string | null;
  authorId: string;
}

export default function StudioPage() {
  return (
    <RequireRole allow={canAuthor}>
      <StudioInner />
    </RequireRole>
  );
}

function StudioInner() {
  const { user } = useCurrentUser();
  const [posts, setPosts] = useState<PostRow[]>([]);

  async function load() {
    const { data } = await client.models.Post.list({});
    let rows = notDeleted(data as PostRow[]);
    if (user && !canModerate(user.role)) {
      rows = rows.filter((p) => p.authorId === user.userId);
    }
    setPosts(rows);
  }

  useEffect(() => {
    if (user) load();
  }, [user?.userId]);

  async function softDelete(id: string) {
    await client.models.Post.update({ id, status: 'DELETED' });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Studio</h1>
        <Link href="/studio/posts/new" className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
          New post
        </Link>
      </div>
      <ul className="divide-y">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <span>
              {p.title} <span className="text-xs text-gray-500">({p.status})</span>
            </span>
            <span className="flex gap-3 text-sm">
              {user && canEditPost(user.role, user.userId, p) && (
                <Link href={`/studio/posts/${p.id}/edit`} className="text-blue-600">Edit</Link>
              )}
              {user && canEditPost(user.role, user.userId, p) && (
                <button onClick={() => softDelete(p.id)} className="text-red-600">Delete</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
