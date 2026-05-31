'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import PostEditor, { type PostDraft } from '@/components/PostEditor';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor, canEditPost } from '@/lib/roles';

export default function EditPostPage() {
  return (
    <RequireRole allow={canAuthor}>
      <EditPostInner />
    </RequireRole>
  );
}

function EditPostInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [originalPublishedAt, setOriginalPublishedAt] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    client.models.Post.get({ id: params.id }).then(({ data }) => {
      if (!data || !user) return;
      if (!canEditPost(user.role, user.userId, data)) {
        setDenied(true);
        return;
      }
      setOriginalPublishedAt(data.publishedAt ?? null);
      setDraft({
        title: data.title,
        excerpt: data.excerpt ?? '',
        bodyMarkdown: data.bodyMarkdown,
        status: data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        coverImageKey: data.coverImageKey ?? null,
        tags: (data.tags ?? []).filter((t): t is string => !!t),
      });
    });
  }, [params.id, user?.userId]);

  async function save(next: PostDraft) {
    await client.models.Post.update({
      id: params.id,
      title: next.title,
      excerpt: next.excerpt,
      bodyMarkdown: next.bodyMarkdown,
      status: next.status,
      coverImageKey: next.coverImageKey ?? null,
      tags: next.tags ?? [],
      publishedAt:
        next.status === 'PUBLISHED'
          ? (originalPublishedAt ?? new Date().toISOString())
          : null,
    });
    router.push('/studio');
  }

  if (denied) return <p className="py-8">You can&apos;t edit this post.</p>;
  if (!draft) return <p className="py-8">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit post</h1>
      <PostEditor initial={draft} onSave={save} />
    </div>
  );
}
