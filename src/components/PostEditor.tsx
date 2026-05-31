'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { uploadData, getUrl } from 'aws-amplify/storage';
import '@uiw/react-md-editor/markdown-editor.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export interface PostDraft {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  status: 'DRAFT' | 'PUBLISHED';
  coverImageKey?: string | null;
  tags?: string[];
}

export default function PostEditor({
  initial,
  onSave,
}: {
  initial: PostDraft;
  onSave: (draft: PostDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PostDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      setUploadError('');
      const key = `media/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      await uploadData({ path: key, data: file }).result;
      const { url } = await getUrl({ path: key });
      const isVideo = file.type.startsWith('video/');
      const snippet = isVideo
        ? `\n<video src="${url.toString()}" controls width="100%"></video>\n`
        : `\n![${file.name}](${url.toString()})\n`;
      setDraft((d) => ({ ...d, bodyMarkdown: d.bodyMarkdown + snippet }));
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverUpload(file: File) {
    setCoverUploading(true);
    try {
      setUploadError('');
      const key = `media/cover-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      await uploadData({ path: key, data: file }).result;
      setDraft((d) => ({ ...d, coverImageKey: key }));
    } catch {
      setUploadError('Cover upload failed. Please try again.');
    } finally {
      setCoverUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded border p-2 text-lg"
        placeholder="Title"
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <input
        className="w-full rounded border p-2"
        placeholder="Excerpt"
        value={draft.excerpt}
        onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
      />
      <input
        className="w-full rounded border p-2"
        placeholder="Tags (comma-separated, e.g. security, ai) — first tag is the category"
        value={(draft.tags ?? []).join(', ')}
        onChange={(e) =>
          setDraft({
            ...draft,
            tags: e.target.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          })
        }
      />
      <label className="block text-sm">
        Cover image:{' '}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
        />
        {coverUploading && <span className="ml-2 text-gray-500">Uploading…</span>}
        {draft.coverImageKey && <span className="ml-2 text-green-600">Cover set ✓</span>}
      </label>
      <label className="block text-sm">
        Upload image/video into body:{' '}
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading && <span className="ml-2 text-gray-500">Uploading…</span>}
        {uploadError && <span className="ml-2 text-red-600">{uploadError}</span>}
      </label>
      <div data-color-mode="light">
        <MDEditor
          height={400}
          value={draft.bodyMarkdown}
          onChange={(v) => setDraft({ ...draft, bodyMarkdown: v ?? '' })}
        />
      </div>
      <div className="flex items-center gap-3">
        <select
          className="rounded border p-2"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value as PostDraft['status'] })}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded bg-primary px-4 py-2 text-white"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
