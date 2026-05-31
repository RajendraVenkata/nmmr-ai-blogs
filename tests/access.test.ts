import { describe, it, expect } from 'vitest';
import {
  requestableRoles,
  canRequestRole,
  pendingRequests,
  deletedItems,
  restoreStatusForPost,
  restoreStatusForComment,
} from '@/lib/access';

describe('requestableRoles', () => {
  it('lets a reader request writer or admin', () => {
    expect(requestableRoles('READER')).toEqual(['CONTENT_WRITER', 'CONTENT_ADMIN']);
  });
  it('lets a writer request only admin', () => {
    expect(requestableRoles('CONTENT_WRITER')).toEqual(['CONTENT_ADMIN']);
  });
  it('offers nothing to admins', () => {
    expect(requestableRoles('CONTENT_ADMIN')).toEqual([]);
    expect(requestableRoles('SYSTEM_ADMIN')).toEqual([]);
  });
});

describe('canRequestRole', () => {
  it('allows a higher requestable role', () => {
    expect(canRequestRole('READER', 'CONTENT_WRITER')).toBe(true);
    expect(canRequestRole('CONTENT_WRITER', 'CONTENT_ADMIN')).toBe(true);
  });
  it('rejects same-or-lower and system admin', () => {
    expect(canRequestRole('CONTENT_WRITER', 'CONTENT_WRITER')).toBe(false);
    expect(canRequestRole('CONTENT_ADMIN', 'CONTENT_WRITER')).toBe(false);
    expect(canRequestRole('READER', 'SYSTEM_ADMIN')).toBe(false);
  });
});

describe('filters', () => {
  const reqs = [
    { id: '1', status: 'PENDING' },
    { id: '2', status: 'APPROVED' },
    { id: '3', status: 'REJECTED' },
  ];
  it('pendingRequests keeps only PENDING', () => {
    expect(pendingRequests(reqs).map((r) => r.id)).toEqual(['1']);
  });
  const content = [
    { id: 'a', status: 'PUBLISHED' },
    { id: 'b', status: 'DELETED' },
    { id: 'c', status: 'ACTIVE' },
  ];
  it('deletedItems keeps only DELETED', () => {
    expect(deletedItems(content).map((r) => r.id)).toEqual(['b']);
  });
});

describe('restore targets', () => {
  it('post restores to DRAFT, comment to ACTIVE', () => {
    expect(restoreStatusForPost()).toBe('DRAFT');
    expect(restoreStatusForComment()).toBe('ACTIVE');
  });
});
