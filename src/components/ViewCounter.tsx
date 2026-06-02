'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { viewedKey, formatViews } from '@/lib/views';

export default function ViewCounter({ postId }: { postId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const { data: row } = await client.models.PostView.get(
          { id: postId },
          { authMode: 'apiKey' },
        );
        const current = row?.count ?? 0;

        // Has this browser already counted a view for this post?
        let alreadyViewed = false;
        try {
          alreadyViewed = window.localStorage.getItem(viewedKey(postId)) !== null;
        } catch {
          alreadyViewed = true; // no storage (private mode) -> don't double count
        }

        if (alreadyViewed) {
          if (active) setCount(current);
          return;
        }

        // First view from this browser: increment once.
        if (active) setCount(current + 1); // optimistic
        try {
          if (row) {
            await client.models.PostView.update(
              { id: postId, count: current + 1 },
              { authMode: 'apiKey' },
            );
          } else {
            await client.models.PostView.create(
              { id: postId, count: 1 },
              { authMode: 'apiKey' },
            );
          }
          try {
            window.localStorage.setItem(viewedKey(postId), '1');
          } catch {
            // ignore storage failures
          }
        } catch {
          // increment failed (e.g. a create race with another first-viewer):
          // fall back to showing the value we read.
          if (active) setCount(current);
        }
      } catch {
        // read failed: leave count unknown (renders nothing)
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [postId]);

  if (count === null) return null;

  return (
    <span className="flex items-center gap-2 text-sm text-gray-500" aria-label={formatViews(count)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" aria-hidden="true">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>{formatViews(count)}</span>
    </span>
  );
}
