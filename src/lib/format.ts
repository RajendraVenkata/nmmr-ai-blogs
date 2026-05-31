export function categoryLabel(tags?: (string | null | undefined)[] | null): string {
  const first = (tags ?? []).find((t) => !!t && t.trim().length > 0);
  return first ? first.trim().toUpperCase() : 'BLOG';
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface HasTags {
  tags?: (string | null)[] | null;
}

export function collectTopics<T extends HasTags>(posts: T[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of posts) {
    for (const t of p.tags ?? []) {
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

export interface Searchable {
  title?: string | null;
  excerpt?: string | null;
  tags?: (string | null)[] | null;
}

export function filterPosts<T extends Searchable>(posts: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return posts;
  return posts.filter((p) => {
    const hay = [p.title ?? '', p.excerpt ?? '', ...(p.tags ?? []).map((t) => t ?? '')]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
