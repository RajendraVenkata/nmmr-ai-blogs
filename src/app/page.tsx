'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import { filterPosts } from '@/lib/format';
import Hero from '@/components/Hero';
import FeatureCards from '@/components/FeatureCards';
import PostCard, { type PostCardData } from '@/components/PostCard';

export default function Home() {
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    client.models.Post.list({ authMode: 'apiKey' }).then(({ data }) => {
      const visible = publishedOnly(data as PostCardData[]).sort((a, b) =>
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
      setPosts(visible);
    });
  }, []);

  const filtered = filterPosts(posts, query);

  return (
    <div className="space-y-12">
      <Hero />
      <FeatureCards />
      <section id="articles" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Latest articles</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-64"
          />
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">
            {query ? 'No articles match your search.' : 'No articles published yet.'}
          </p>
        )}
      </section>
    </div>
  );
}
