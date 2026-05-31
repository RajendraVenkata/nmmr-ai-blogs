export interface HasStatus {
  status?: string | null;
}

export function publishedOnly<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'PUBLISHED');
}

export function notDeleted<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status !== 'DELETED');
}
