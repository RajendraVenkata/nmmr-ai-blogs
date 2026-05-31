'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  status?: string | null;
  publishedAt?: string | null;
}

export default function Home() {
  const [posts, setPosts] = useState<PostRow[]>([]);

  useEffect(() => {
    client.models.Post.list({ authMode: 'apiKey' }).then(({ data }) => {
      const visible = publishedOnly(data as PostRow[]).sort((a, b) =>
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
      setPosts(visible);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Latest posts</h1>
      {posts.map((p) => (
        <article key={p.id} className="border-b pb-4">
          <Link href={`/posts/${p.slug}`} className="text-xl font-semibold text-blue-700">
            {p.title}
          </Link>
          {p.excerpt && <p className="text-gray-600">{p.excerpt}</p>}
        </article>
      ))}
      {posts.length === 0 && <p className="text-gray-500">No posts published yet.</p>}
    </div>
  );
}
