import { describe, it, expect } from 'vitest';
import { buildPostMetadata } from '@/lib/postMetadata';
import type { PostRow } from '@/lib/posts';

const base: PostRow = {
  id: '1',
  slug: 'hello-world',
  title: 'Hello World',
  bodyMarkdown: '# hi',
  excerpt: 'A short excerpt',
  tags: ['ai'],
  coverImageKey: 'media/cover.jpg',
  status: 'PUBLISHED',
  authorName: 'Rajendra',
  publishedAt: '2026-06-01T00:00:00.000Z',
};

describe('buildPostMetadata', () => {
  it('uses post title and excerpt', () => {
    const m = buildPostMetadata({ post: base, ogImageUrl: 'https://img/x.jpg' });
    expect(m.title).toBe('Hello World');
    expect(m.description).toBe('A short excerpt');
  });

  it('falls back to site description when excerpt is empty', () => {
    const m = buildPostMetadata({ post: { ...base, excerpt: '   ' }, ogImageUrl: 'x' });
    expect(m.description).toBe('Hands-on insights on AI and engineering');
  });

  it('sets canonical and article OG with image and author', () => {
    const m = buildPostMetadata({ post: base, ogImageUrl: 'https://img/x.jpg' });
    expect(m.alternates?.canonical).toBe('/posts/hello-world');
    expect((m.openGraph as any).type).toBe('article');
    expect((m.openGraph as any).url).toBe('/posts/hello-world');
    expect((m.openGraph as any).authors).toEqual(['Rajendra']);
    expect((m.openGraph as any).images[0].url).toBe('https://img/x.jpg');
  });

  it('emits a summary_large_image twitter card', () => {
    const m = buildPostMetadata({ post: base, ogImageUrl: 'https://img/x.jpg' });
    expect((m.twitter as any).card).toBe('summary_large_image');
    expect((m.twitter as any).images).toEqual(['https://img/x.jpg']);
  });

  it('omits author when authorName is absent', () => {
    const m = buildPostMetadata({ post: { ...base, authorName: null }, ogImageUrl: 'x' });
    expect((m.openGraph as any).authors).toBeUndefined();
  });
});
