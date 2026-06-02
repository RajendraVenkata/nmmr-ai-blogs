import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPostBySlug } from '@/lib/serverClient';
import { getSignedMediaUrl } from '@/lib/amplifyServer';
import { buildPostMetadata } from '@/lib/postMetadata';
import PostDetailClient from './PostDetailClient';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) return { title: 'Post not found' };

  const ogImageUrl = post.coverImageKey
    ? await getSignedMediaUrl(post.coverImageKey)
    : `/posts/${post.slug}/og`;

  return buildPostMetadata({ post, ogImageUrl });
}

export default async function PostDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) notFound();
  return <PostDetailClient post={post} />;
}
