'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { client } from '@/lib/client';
import { publishedOnly } from '@/lib/posts';
import MarkdownView from '@/components/MarkdownView';
import ShareButtons from '@/components/ShareButtons';
import Comments from '@/components/Comments';

interface PostRow {
  id: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  status?: string | null;
  authorName?: string | null;
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

  return (
    <article className="space-y-2">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      {post.authorName && <p className="text-sm text-gray-500">By {post.authorName}</p>}
      <ShareButtons url={url} title={post.title} />
      <MarkdownView markdown={post.bodyMarkdown} />
      <div className="pt-8">
        <Comments postId={post.id} />
      </div>
    </article>
  );
}
