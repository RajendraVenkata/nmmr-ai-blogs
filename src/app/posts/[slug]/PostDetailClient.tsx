'use client';

import { categoryLabel } from '@/lib/format';
import type { PostRow } from '@/lib/posts';
import { SITE_URL } from '@/lib/site';
import MarkdownView from '@/components/MarkdownView';
import ShareButtons from '@/components/ShareButtons';
import LikeButton from '@/components/LikeButton';
import Comments from '@/components/Comments';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import CoverImage from '@/components/CoverImage';

export default function PostDetailClient({ post }: { post: PostRow }) {
  const url =
    typeof window !== 'undefined'
      ? window.location.href
      : `${SITE_URL}/posts/${post.slug}`;
  const label = categoryLabel(post.tags ?? []);

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <CategoryChip label={label} />
      <h1 className="text-4xl font-extrabold leading-tight">{post.title}</h1>
      <PostMeta authorName={post.authorName} date={post.publishedAt} />
      <CoverImage
        coverKey={post.coverImageKey}
        label={label}
        className="aspect-[16/9] w-full rounded"
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LikeButton postId={post.id} />
        <ShareButtons url={url} title={post.title} />
      </div>
      <MarkdownView markdown={post.bodyMarkdown} />
      <div className="pt-8">
        <Comments postId={post.id} />
      </div>
    </article>
  );
}
