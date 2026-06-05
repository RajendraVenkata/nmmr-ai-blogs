export interface HasStatus {
  status?: string | null;
}

export function publishedOnly<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'PUBLISHED');
}

export function notDeleted<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status !== 'DELETED');
}

export function pendingReview<T extends HasStatus>(items: T[]): T[] {
  return items.filter((i) => i.status === 'PENDING_REVIEW');
}

export interface PostRow {
  id: string;
  slug: string;
  title: string;
  bodyMarkdown: string;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
  coverImageKey?: string | null;
  status?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
}
