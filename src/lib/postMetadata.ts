import type { Metadata } from 'next';
import type { PostRow } from './posts';

const SITE_NAME = 'NMMR AI Blogs';
const SITE_DESCRIPTION = 'Hands-on insights on AI and engineering';

export function buildPostMetadata({
  post,
  ogImageUrl,
}: {
  post: PostRow;
  ogImageUrl: string;
}): Metadata {
  const description = post.excerpt?.trim() || SITE_DESCRIPTION;
  const path = `/posts/${post.slug}`;
  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: post.title,
      description,
      url: path,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.publishedAt ?? undefined,
      authors: post.authorName ? [post.authorName] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImageUrl],
    },
  };
}
