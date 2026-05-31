'use client';

import { useRouter } from 'next/navigation';
import RequireRole from '@/components/RequireRole';
import PostEditor, { type PostDraft } from '@/components/PostEditor';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canAuthor } from '@/lib/roles';
import { uniqueSlug } from '@/lib/slug';

export default function NewPostPage() {
  return (
    <RequireRole allow={canAuthor}>
      <NewPostInner />
    </RequireRole>
  );
}

function NewPostInner() {
  const router = useRouter();
  const { user } = useCurrentUser();

  async function save(draft: PostDraft) {
    if (!user) return;
    const { data: existing } = await client.models.Post.list({
      filter: { status: { ne: 'DELETED' } },
    });
    const slugs = (existing ?? []).map((p) => p.slug);
    const slug = uniqueSlug(draft.title, slugs);
    await client.models.Post.create({
      ...draft,
      slug,
      authorId: user.userId,
      authorName: user.email,
      publishedAt: draft.status === 'PUBLISHED' ? new Date().toISOString() : null,
    });
    router.push('/studio');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New post</h1>
      <PostEditor
        initial={{ title: '', excerpt: '', bodyMarkdown: '', status: 'DRAFT', coverImageKey: null, tags: [] }}
        onSave={save}
      />
    </div>
  );
}
