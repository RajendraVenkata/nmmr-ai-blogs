import type { Role } from '@/lib/roles';

export type RequestableRole = 'CONTENT_WRITER' | 'CONTENT_ADMIN';

const ROLE_RANK: Record<Role, number> = {
  READER: 0,
  CONTENT_WRITER: 1,
  CONTENT_ADMIN: 2,
  SYSTEM_ADMIN: 3,
};

const REQUESTABLE: RequestableRole[] = ['CONTENT_WRITER', 'CONTENT_ADMIN'];

export function requestableRoles(currentRole: Role): RequestableRole[] {
  return REQUESTABLE.filter((r) => ROLE_RANK[r] > ROLE_RANK[currentRole]);
}

export function canRequestRole(currentRole: Role, target: Role): boolean {
  if (target !== 'CONTENT_WRITER' && target !== 'CONTENT_ADMIN') return false;
  return ROLE_RANK[target] > ROLE_RANK[currentRole];
}

export interface HasStatus {
  status?: string | null;
}

export function pendingRequests<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'PENDING');
}

export function deletedItems<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'DELETED');
}

export function restoreStatusForPost(): 'DRAFT' {
  return 'DRAFT';
}

export function restoreStatusForComment(): 'ACTIVE' {
  return 'ACTIVE';
}

const REQUEST_LABELS: Record<string, string> = {
  CODER: 'Coder access',
  CONTENT_WRITER: 'Content Writer',
  CONTENT_ADMIN: 'Content Admin',
};

export function requestLabel(value: string): string {
  return REQUEST_LABELS[value] ?? value;
}

export function isCoderRequest(requestedRole: string | null | undefined): boolean {
  return requestedRole === 'CODER';
}
