import { describe, it, expect } from 'vitest';
import { categoryLabel, formatDate, collectTopics, filterPosts } from '@/lib/format';

describe('categoryLabel', () => {
  it('uppercases the first non-empty tag', () => {
    expect(categoryLabel(['security', 'ai'])).toBe('SECURITY');
  });
  it('falls back to BLOG when there are no tags', () => {
    expect(categoryLabel([])).toBe('BLOG');
    expect(categoryLabel(undefined)).toBe('BLOG');
    expect(categoryLabel([null, '  '])).toBe('BLOG');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as "29 May 2026"', () => {
    expect(formatDate('2026-05-29T10:00:00Z')).toBe('29 May 2026');
  });
  it('returns empty string for missing or invalid input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('collectTopics', () => {
  it('returns distinct tags in first-seen order', () => {
    const posts = [
      { tags: ['a', 'b'] },
      { tags: ['b', 'c'] },
      { tags: null },
    ];
    expect(collectTopics(posts)).toEqual(['a', 'b', 'c']);
  });
});

describe('filterPosts', () => {
  const posts = [
    { title: 'AI safety', excerpt: 'about ai', tags: ['ai'] },
    { title: 'Cooking', excerpt: 'food stuff', tags: ['life'] },
  ];
  it('returns all posts for an empty query', () => {
    expect(filterPosts(posts, '')).toHaveLength(2);
  });
  it('matches title, excerpt, or tag case-insensitively', () => {
    expect(filterPosts(posts, 'AI').map((p) => p.title)).toEqual(['AI safety']);
    expect(filterPosts(posts, 'food').map((p) => p.title)).toEqual(['Cooking']);
    expect(filterPosts(posts, 'life').map((p) => p.title)).toEqual(['Cooking']);
  });
});
