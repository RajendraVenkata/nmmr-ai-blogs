'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import { categoryLabel } from '@/lib/format';
import MarkdownView from '@/components/MarkdownView';
import ShareButtons from '@/components/ShareButtons';
import Comments from '@/components/Comments';
import CategoryChip from '@/components/CategoryChip';
import PostMeta from '@/components/PostMeta';
import CoverImage from '@/components/CoverImage';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
  coverImageKey?: string | null;
  status?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
}

export default function PostDetail() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    client.models.Post.list({
      filter: { slug: { eq: params.slug } },
      authMode: 'apiKey',
    }).then(({ data }) => {
      const match = publishedOnly(data as PostRow[])[0];
      if (match) setPost(match);
      else setNotFound(true);
    });
  }, [params.slug]);

  if (notFound) return <p className="py-8">Post not found.</p>;
  if (!post) return <p className="py-8">Loading…</p>;

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const label = categoryLabel(post.tags ?? []);

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <CategoryChip label={label} />
      <h1 className="text-4xl font-extrabold leading-tight">{post.title}</h1>
      <PostMeta authorName={post.authorName} date={post.publishedAt} />
      <CoverImage coverKey={post.coverImageKey} label={label} className="aspect-[16/9] w-full rounded" />
      <ShareButtons url={url} title={post.title} />
      <MarkdownView markdown={post.bodyMarkdown} />
      <div className="pt-8">
        <Comments postId={post.id} />
      </div>
    </article>
  );
}
