import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(slugify('  Hello, World! ')).toBe('hello-world');
  });
  it('collapses repeated separators', () => {
    expect(slugify('A  --  B')).toBe('a-b');
  });
  it('strips non-alphanumeric characters', () => {
    expect(slugify('Café & Co.')).toBe('caf-co');
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when unused', () => {
    expect(uniqueSlug('My Post', [])).toBe('my-post');
  });
  it('appends an incrementing suffix on collision', () => {
    expect(uniqueSlug('My Post', ['my-post', 'my-post-2'])).toBe('my-post-3');
  });
  it('falls back to "post" for empty input', () => {
    expect(uniqueSlug('!!!', [])).toBe('post');
  });
});
