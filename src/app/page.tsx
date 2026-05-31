'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import { filterPosts } from '@/lib/format';
import { useSearch } from '@/lib/SearchContext';
import ArticleCard, { type ArticleCardPost } from '@/components/ArticleCard';
import Sidebar from '@/components/Sidebar';

export default function Home() {
  const [posts, setPosts] = useState<ArticleCardPost[]>([]);
  const { query } = useSearch();

  useEffect(() => {
    client.models.Post.list({ authMode: 'apiKey' }).then(({ data }) => {
      const visible = publishedOnly(data as ArticleCardPost[]).sort((a, b) =>
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
      setPosts(visible);
    });
  }, []);

  const filtered = filterPosts(posts, query);
  const lead = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        {lead ? (
          <>
            <ArticleCard post={lead} variant="lead" />
            <div className="space-y-4">
              {rest.map((p) => (
                <ArticleCard key={p.id} post={p} variant="standard" />
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-500">
            {query ? 'No posts match your search.' : 'No posts published yet.'}
          </p>
        )}
      </div>
      <Sidebar posts={posts} />
    </div>
  );
}
