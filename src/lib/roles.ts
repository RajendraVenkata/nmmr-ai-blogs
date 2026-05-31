export type Role = 'READER' | 'CONTENT_WRITER' | 'CONTENT_ADMIN' | 'SYSTEM_ADMIN';

export const ROLE_TO_GROUP: Record<Role, string | null> = {
  READER: null,
  CONTENT_WRITER: 'ContentWriter',
  CONTENT_ADMIN: 'ContentAdmin',
  SYSTEM_ADMIN: 'SystemAdmin',
};

export const ASSIGNABLE_ROLES: Role[] = [
  'READER',
  'CONTENT_WRITER',
  'CONTENT_ADMIN',
  'SYSTEM_ADMIN',
];

export function roleFromGroups(groups: string[]): Role {
  if (groups.includes('SystemAdmin')) return 'SYSTEM_ADMIN';
  if (groups.includes('ContentAdmin')) return 'CONTENT_ADMIN';
  if (groups.includes('ContentWriter')) return 'CONTENT_WRITER';
  return 'READER';
}

export function canAuthor(role: Role): boolean {
  return role === 'CONTENT_WRITER' || role === 'CONTENT_ADMIN' || role === 'SYSTEM_ADMIN';
}

export function canModerate(role: Role): boolean {
  return role === 'CONTENT_ADMIN' || role === 'SYSTEM_ADMIN';
}

export function canGrantRoles(role: Role): boolean {
  return role === 'SYSTEM_ADMIN';
}

export function canEditPost(
  role: Role,
  userId: string,
  post: { authorId: string },
): boolean {
  if (canModerate(role)) return true;
  if (role === 'CONTENT_WRITER') return post.authorId === userId;
  return false;
}
