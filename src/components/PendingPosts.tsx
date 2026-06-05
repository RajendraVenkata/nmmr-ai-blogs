'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { pendingReview } from '@/lib/posts';
import MarkdownView from '@/components/MarkdownView';

interface PendingRow {
  id: string;
  title?: string | null;
  authorName?: string | null;
  excerpt?: string | null;
  bodyMarkdown?: string | null;
  status?: string | null;
}

export default function PendingPosts() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [busy, setBusy] = useState('');
  const [openId, setOpenId] = useState('');

  async function load() {
    const { data } = await client.models.Post.list({ filter: { status: { eq: 'PENDING_REVIEW' } } });
    // belt-and-suspenders: the API filter above is the primary guard
    setRows(pendingReview(data as PendingRow[]));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setBusy(id);
    try {
      await client.models.Post.update({ id, status: 'PUBLISHED', publishedAt: new Date().toISOString() });
      await load();
    } finally {
      setBusy('');
    }
  }

  async function reject(id: string) {
    setBusy(id);
    try {
      await client.models.Post.update({ id, status: 'DRAFT' });
      await load();
    } finally {
      setBusy('');
    }
  }

  return (
    <ul className="divide-y">
      {rows.map((p) => (
        <li key={p.id} className="py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{p.title ?? p.id}</div>
              {p.authorName && <div className="text-gray-500">by {p.authorName}</div>}
              {p.excerpt && <div className="text-gray-600">{p.excerpt}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button onClick={() => setOpenId(openId === p.id ? '' : p.id)} className="text-primary">
                {openId === p.id ? 'Hide' : 'Preview'}
              </button>
              <button
                disabled={busy === p.id}
                onClick={() => approve(p.id)}
                className="rounded bg-green-600 px-2 py-1 text-xs text-white"
              >
                Approve
              </button>
              <button
                disabled={busy === p.id}
                onClick={() => reject(p.id)}
                className="rounded bg-red-600 px-2 py-1 text-xs text-white"
              >
                Reject
              </button>
            </div>
          </div>
          {openId === p.id && p.bodyMarkdown && (
            <div className="mt-3 rounded border p-3">
              <MarkdownView markdown={p.bodyMarkdown} />
            </div>
          )}
        </li>
      ))}
      {rows.length === 0 && <li className="py-3 text-sm text-gray-500">No posts awaiting review.</li>}
    </ul>
  );
}
