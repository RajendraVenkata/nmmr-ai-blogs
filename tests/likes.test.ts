import { describe, it, expect } from 'vitest';
import { likeId, userHasLiked, type LikeRow } from '@/lib/likes';

describe('likeId', () => {
  it('joins postId and userId with the separator', () => {
    expect(likeId('p1', 'u1')).toBe('p1::u1');
  });
});

describe('userHasLiked', () => {
  const rows: LikeRow[] = [
    { id: 'p1::u1', postId: 'p1', userId: 'u1' },
    { id: 'p1::u2', postId: 'p1', userId: 'u2' },
  ];
  it('true when the user has a like row for the post', () => {
    expect(userHasLiked(rows, 'p1', 'u1')).toBe(true);
  });
  it('false when the user has not liked', () => {
    expect(userHasLiked(rows, 'p1', 'u3')).toBe(false);
  });
  it('false for empty rows', () => {
    expect(userHasLiked([], 'p1', 'u1')).toBe(false);
  });
});
