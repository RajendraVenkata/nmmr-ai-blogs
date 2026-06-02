import { describe, it, expect } from 'vitest';
import { viewedKey, formatViews } from '@/lib/views';

describe('viewedKey', () => {
  it('namespaces the post id', () => {
    expect(viewedKey('abc')).toBe('viewed:abc');
  });
});

describe('formatViews', () => {
  it('uses singular for exactly one', () => {
    expect(formatViews(1)).toBe('1 view');
  });
  it('uses plural for zero', () => {
    expect(formatViews(0)).toBe('0 views');
  });
  it('uses plural for many', () => {
    expect(formatViews(42)).toBe('42 views');
  });
});
