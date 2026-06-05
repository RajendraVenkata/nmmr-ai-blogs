import { describe, it, expect } from 'vitest';
import {
  roleFromGroups,
  canAuthor,
  canModerate,
  canGrantRoles,
  canEditPost,
  canUseContainers,
} from '@/lib/roles';

describe('roleFromGroups', () => {
  it('picks the highest-privilege group', () => {
    expect(roleFromGroups(['ContentWriter', 'SystemAdmin'])).toBe('SYSTEM_ADMIN');
    expect(roleFromGroups(['ContentAdmin'])).toBe('CONTENT_ADMIN');
    expect(roleFromGroups(['ContentWriter'])).toBe('CONTENT_WRITER');
    expect(roleFromGroups([])).toBe('READER');
  });
});

describe('capability helpers', () => {
  it('authoring requires writer or above', () => {
    expect(canAuthor('READER')).toBe(false);
    expect(canAuthor('CONTENT_WRITER')).toBe(true);
    expect(canAuthor('SYSTEM_ADMIN')).toBe(true);
  });
  it('moderation requires admin or above', () => {
    expect(canModerate('CONTENT_WRITER')).toBe(false);
    expect(canModerate('CONTENT_ADMIN')).toBe(true);
  });
  it('only system admins grant roles', () => {
    expect(canGrantRoles('CONTENT_ADMIN')).toBe(false);
    expect(canGrantRoles('SYSTEM_ADMIN')).toBe(true);
  });
});

describe('canEditPost', () => {
  const post = { authorId: 'u1' };
  it('writers edit only their own posts', () => {
    expect(canEditPost('CONTENT_WRITER', 'u1', post)).toBe(true);
    expect(canEditPost('CONTENT_WRITER', 'u2', post)).toBe(false);
  });
  it('admins edit any post', () => {
    expect(canEditPost('CONTENT_ADMIN', 'u2', post)).toBe(true);
  });
  it('readers edit nothing', () => {
    expect(canEditPost('READER', 'u1', post)).toBe(false);
  });
});

describe('canUseContainers', () => {
  it('is true when the Coder group is present', () => {
    expect(canUseContainers(['Coder'])).toBe(true);
    expect(canUseContainers(['ContentWriter', 'Coder'])).toBe(true);
  });
  it('is false without the Coder group', () => {
    expect(canUseContainers([])).toBe(false);
    expect(canUseContainers(['SystemAdmin'])).toBe(false);
  });
});
