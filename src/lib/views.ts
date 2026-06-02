export function viewedKey(postId: string): string {
  return `viewed:${postId}`;
}

export function formatViews(n: number): string {
  return `${n} ${n === 1 ? 'view' : 'views'}`;
}
