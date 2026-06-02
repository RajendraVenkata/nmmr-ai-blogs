import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedPostBySlug } from '@/lib/serverClient';
import { buildPostMetadata } from '@/lib/postMetadata';
import PostDetailClient from './PostDetailClient';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) return { title: 'Post not found' };

  // Always serve the OG image through our own PNG endpoint. Social scrapers
  // (LinkedIn/X/Facebook) reject SVG covers and choke on presigned S3 URLs
  // (temporary token, 15-min expiry). The /og route rasterizes to a stable PNG.
  const ogImageUrl = `/posts/${post.slug}/og`;

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
