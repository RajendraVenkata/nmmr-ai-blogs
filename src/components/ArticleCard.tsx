'use client';

import Link from 'next/link';
import CoverImage from '@/components/CoverImage';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import { categoryLabel } from '@/lib/format';

export interface ArticleCardPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
  coverImageKey?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
  status?: string | null;
}

export default function ArticleCard({
  post,
  variant = 'standard',
}: {
  post: ArticleCardPost;
  variant?: 'lead' | 'standard';
}) {
  const label = categoryLabel(post.tags ?? []);

  if (variant === 'lead') {
    return (
      <article className="space-y-3">
        <Link href={`/posts/${post.slug}`} className="block">
          <div className="relative">
            <CoverImage coverKey={post.coverImageKey} label={label} className="aspect-[16/9] w-full rounded" />
            <div className="absolute left-3 top-3">
              <CategoryChip label={label} />
            </div>
          </div>
        </Link>
        <Link href={`/posts/${post.slug}`}>
          <h2 className="text-3xl font-extrabold leading-tight decoration-brand hover:underline">
            {post.title}
          </h2>
        </Link>
        <PostMeta authorName={post.authorName} date={post.publishedAt} />
        {post.excerpt && <p className="text-gray-600">{post.excerpt}</p>}
      </article>
    );
  }

  return (
    <article className="flex gap-4 border-b pb-4">
      <Link href={`/posts/${post.slug}`} className="shrink-0">
        <CoverImage coverKey={post.coverImageKey} label={label} className="h-24 w-36 rounded" />
      </Link>
      <div className="space-y-1">
        <CategoryChip label={label} />
        <Link href={`/posts/${post.slug}`}>
          <h3 className="text-lg font-bold leading-snug decoration-brand hover:underline">
            {post.title}
          </h3>
        </Link>
        <PostMeta authorName={post.authorName} date={post.publishedAt} />
      </div>
    </article>
  );
}
