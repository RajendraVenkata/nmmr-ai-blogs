import { describe, it, expect } from 'vitest';
import {
  requestableRoles,
  canRequestRole,
  pendingRequests,
  deletedItems,
  restoreStatusForPost,
  restoreStatusForComment,
  requestLabel,
  isCoderRequest,
  requestOptions,
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

describe('requestLabel', () => {
  it('labels CODER as Coder access', () => {
    expect(requestLabel('CODER')).toBe('Coder access');
  });
  it('labels roles in friendly form', () => {
    expect(requestLabel('CONTENT_WRITER')).toBe('Content Writer');
    expect(requestLabel('CONTENT_ADMIN')).toBe('Content Admin');
  });
  it('passes unknown values through', () => {
    expect(requestLabel('SOMETHING')).toBe('SOMETHING');
  });
});

describe('isCoderRequest', () => {
  it('is true only for CODER', () => {
    expect(isCoderRequest('CODER')).toBe(true);
    expect(isCoderRequest('CONTENT_WRITER')).toBe(false);
    expect(isCoderRequest(null)).toBe(false);
    expect(isCoderRequest(undefined)).toBe(false);
  });
});

describe('requestOptions', () => {
  it('offers roles and Coder to a non-coder reader', () => {
    expect(requestOptions('READER', false)).toEqual([
      { value: 'CONTENT_WRITER', label: 'Content Writer' },
      { value: 'CONTENT_ADMIN', label: 'Content Admin' },
      { value: 'CODER', label: 'Coder access' },
    ]);
  });
  it('omits Coder when the user already has it', () => {
    expect(requestOptions('READER', true)).toEqual([
      { value: 'CONTENT_WRITER', label: 'Content Writer' },
      { value: 'CONTENT_ADMIN', label: 'Content Admin' },
    ]);
  });
  it('offers only Coder to a non-coder content admin', () => {
    expect(requestOptions('CONTENT_ADMIN', false)).toEqual([
      { value: 'CODER', label: 'Coder access' },
    ]);
  });
  it('offers nothing to a content admin who is already a coder', () => {
    expect(requestOptions('CONTENT_ADMIN', true)).toEqual([]);
  });
  it('offers Coder to a non-coder system admin', () => {
    expect(requestOptions('SYSTEM_ADMIN', false)).toEqual([
      { value: 'CODER', label: 'Coder access' },
    ]);
  });
});
