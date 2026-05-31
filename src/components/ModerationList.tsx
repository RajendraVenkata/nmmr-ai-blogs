'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { deletedItems, restoreStatusForPost, restoreStatusForComment } from '@/lib/access';

interface PostRow {
  id: string;
  title?: string | null;
  status?: string | null;
}
interface CommentRow {
  id: string;
  body?: string | null;
  status?: string | null;
}

export default function ModerationList() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);

  async function load() {
    const { data: p } = await client.models.Post.list({ filter: { status: { eq: 'DELETED' } } });
    const { data: c } = await client.models.Comment.list({ filter: { status: { eq: 'DELETED' } } });
    setPosts(deletedItems(p as PostRow[]));
    setComments(deletedItems(c as CommentRow[]));
  }

  useEffect(() => {
    load();
  }, []);

  async function restorePost(id: string) {
    await client.models.Post.update({ id, status: restoreStatusForPost() });
    load();
  }

  async function restoreComment(id: string) {
    await client.models.Comment.update({ id, status: restoreStatusForComment() });
    load();
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Deleted posts</h2>
        <ul className="divide-y">
          {posts.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>{p.title ?? p.id}</span>
              <button onClick={() => restorePost(p.id)} className="text-primary">
                Restore (to draft)
              </button>
            </li>
          ))}
          {posts.length === 0 && <li className="py-2 text-sm text-gray-500">None.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Deleted comments</h2>
        <ul className="divide-y">
          {comments.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate">{c.body ?? c.id}</span>
              <button onClick={() => restoreComment(c.id)} className="ml-3 text-primary">
                Restore
              </button>
            </li>
          ))}
          {comments.length === 0 && <li className="py-2 text-sm text-gray-500">None.</li>}
        </ul>
      </section>
    </div>
  );
}
