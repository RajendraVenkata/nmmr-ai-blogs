export const LIKE_ID_SEP = '::';

export interface LikeRow {
  id: string;
  postId: string;
  userId: string;
}

export function likeId(postId: string, userId: string): string {
  return `${postId}${LIKE_ID_SEP}${userId}`;
}

export function userHasLiked(rows: LikeRow[], postId: string, userId: string): boolean {
  const id = likeId(postId, userId);
  return rows.some((r) => r.id === id);
}
