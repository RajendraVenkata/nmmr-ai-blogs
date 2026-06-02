'use client';

import { useCallback, useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { likeId, userHasLiked, type LikeRow } from '@/lib/likes';

export default function LikeButton({ postId }: { postId: string }) {
  const { user } = useCurrentUser();
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const userId = user?.userId;

  const load = useCallback(async () => {
    try {
      const rows: LikeRow[] = [];
      let token: string | undefined;
      do {
        const page = await client.models.Like.list({
          filter: { postId: { eq: postId } },
          authMode: 'apiKey',
          limit: 1000,
          nextToken: token,
        });
        rows.push(...(page.data as LikeRow[]));
        token = page.nextToken ?? undefined;
      } while (token);
      setCount(rows.length);
      setLiked(userId ? userHasLiked(rows, postId, userId) : false);
    } catch {
      // keep current state if the read fails
    }
  }, [postId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);
    const id = likeId(postId, user.userId);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      if (next) {
        await client.models.Like.create({ id, postId, userId: user.userId });
      } else {
        await client.models.Like.delete({ id });
      }
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const heart = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'}
         stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500" title="Sign in to like">
        {heart}
        <span>{count}</span>
        <span className="text-xs">Sign in to like</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this post' : 'Like this post'}
      className={`flex items-center gap-2 text-sm transition-colors disabled:opacity-60 ${
        liked ? 'text-primary' : 'text-gray-500 hover:text-primary'
      }`}
    >
      {heart}
      <span>{count}</span>
    </button>
  );
}
