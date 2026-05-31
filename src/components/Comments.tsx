'use client';

import { useCallback, useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canModerate } from '@/lib/roles';
import { notDeleted } from '@/lib/posts';

interface CommentRow {
  id: string;
  body: string;
  authorId: string;
  authorName?: string | null;
  status?: string | null;
}

export default function Comments({ postId }: { postId: string }) {
  const { user } = useCurrentUser();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    const { data } = await client.models.Comment.list({
      filter: { postId: { eq: postId } },
      authMode: 'apiKey',
    });
    setComments(notDeleted(data as CommentRow[]));
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!user || !body.trim()) return;
    await client.models.Comment.create({
      postId,
      body: body.trim(),
      authorId: user.userId,
      authorName: user.email,
      status: 'ACTIVE',
    });
    setBody('');
    load();
  }

  async function softDelete(id: string) {
    await client.models.Comment.update({ id, status: 'DELETED' });
    load();
  }

  return (
    <section className="border-t pt-6">
      <h2 className="mb-3 text-lg font-semibold">Comments</h2>
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{c.authorName ?? 'Anonymous'}</div>
            <div>{c.body}</div>
            {user && (canModerate(user.role) || user.userId === c.authorId) && (
              <button onClick={() => softDelete(c.id)} className="mt-1 text-xs text-red-600">
                Delete
              </button>
            )}
          </li>
        ))}
        {comments.length === 0 && <li className="text-sm text-gray-500">No comments yet.</li>}
      </ul>
      {user ? (
        <div className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded border p-2 text-sm"
            placeholder="Write a comment…"
          />
          <button onClick={add} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
            Post comment
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Sign in to comment.</p>
      )}
    </section>
  );
}
