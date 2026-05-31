'use client';

import Link from 'next/link';
import { useSearch } from '@/lib/SearchContext';
import { formatDate, collectTopics } from '@/lib/format';

interface SidebarPost {
  id: string;
  slug: string;
  title: string;
  publishedAt?: string | null;
  tags?: (string | null)[] | null;
}

export default function Sidebar({ posts }: { posts: SidebarPost[] }) {
  const { setQuery, setOpen } = useSearch();
  const latest = posts.slice(0, 5);
  const topics = collectTopics(posts);

  return (
    <aside className="space-y-8">
      <section>
        <h2 className="mb-3 border-b pb-1 text-lg font-bold">Latest posts</h2>
        <ul className="space-y-3">
          {latest.map((p) => (
            <li key={p.id}>
              <Link href={`/posts/${p.slug}`} className="font-medium text-link hover:underline">
                {p.title}
              </Link>
              <div className="text-xs text-gray-400">{formatDate(p.publishedAt)}</div>
            </li>
          ))}
          {latest.length === 0 && <li className="text-sm text-gray-400">Nothing yet.</li>}
        </ul>
      </section>
      {topics.length > 0 && (
        <section>
          <h2 className="mb-3 border-b pb-1 text-lg font-bold">Topics</h2>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setQuery(t);
                  setOpen(true);
                }}
                className="rounded-full border px-3 py-1 text-xs hover:border-brand hover:text-brand"
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
