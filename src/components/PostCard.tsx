'use client';

import Link from 'next/link';
import CoverImage from '@/components/CoverImage';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import { categoryLabel } from '@/lib/format';

export interface PostCardData {
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

export default function PostCard({ post }: { post: PostCardData }) {
  const label = categoryLabel(post.tags ?? []);
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <CoverImage coverKey={post.coverImageKey} label={label} className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <CategoryChip label={label} />
        <h3 className="text-lg font-bold leading-snug text-gray-900 group-hover:text-primary">
          {post.title}
        </h3>
        {post.excerpt && <p className="line-clamp-2 text-sm text-gray-600">{post.excerpt}</p>}
        <div className="mt-auto pt-2">
          <PostMeta authorName={post.authorName} date={post.publishedAt} />
        </div>
      </div>
    </Link>
  );
}
