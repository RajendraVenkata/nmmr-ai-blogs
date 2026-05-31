import { describe, it, expect } from 'vitest';
import { publishedOnly, notDeleted } from '@/lib/posts';

const rows = [
  { id: '1', status: 'PUBLISHED' },
  { id: '2', status: 'DRAFT' },
  { id: '3', status: 'DELETED' },
];

describe('soft-delete filters', () => {
  it('publishedOnly keeps only PUBLISHED', () => {
    expect(publishedOnly(rows).map((r) => r.id)).toEqual(['1']);
  });
  it('notDeleted drops only DELETED', () => {
    expect(notDeleted(rows).map((r) => r.id)).toEqual(['1', '2']);
  });
});
