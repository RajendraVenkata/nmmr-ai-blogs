'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';

interface Source {
  source?: string | null;
  page?: number | null;
  score?: number;
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `Request failed (${res.status})`);
  return data;
}

export default function RagAppPage() {
  const { user, loading } = useCurrentUser();

  const [url, setUrl] = useState('');
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-primary underline">sign in</Link>.
      </p>
    );
  }
  if (!canUseContainers(user.groups)) {
    return <p className="py-8">You need Coder access to use this app.</p>;
  }

  async function ingestUrl() {
    if (!url.trim()) return;
    setIngesting(true);
    setIngestMsg(null);
    setError(null);
    try {
      const data = await postJson('/api/rag/ingest/url', { url: url.trim() });
      setIngestMsg(`Ingested ${data.chunks} chunks from ${data.source}`);
      setUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to ingest URL');
    } finally {
      setIngesting(false);
    }
  }

  async function ingestPdf(file: File) {
    setIngesting(true);
    setIngestMsg(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const res = await fetch('/api/rag/ingest/pdf', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || `Upload failed (${res.status})`);
      setIngestMsg(`Ingested ${data.chunks} chunks from ${data.source}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to ingest PDF');
    } finally {
      setIngesting(false);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const data = await postJson('/api/rag/chat', { question: question.trim(), k: 4 });
      setAnswer(data.answer ?? '');
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed');
    } finally {
      setAsking(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
  const btnClass =
    'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryDark disabled:opacity-50';

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-sm text-gray-500">
          <Link href="/guides" className="hover:text-gray-900">Guides</Link> / Simple RAG application
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Simple RAG application</h1>
        <p className="text-gray-600">
          Add documents to the knowledge base, then ask questions answered from that content.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Ingest */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">1. Add documents</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">From a URL</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className={inputClass}
            />
            <button onClick={ingestUrl} disabled={ingesting || !url.trim()} className={`${btnClass} shrink-0`}>
              {ingesting ? 'Working…' : 'Ingest URL'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">From a PDF</label>
          <input
            type="file"
            accept="application/pdf"
            disabled={ingesting}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ingestPdf(f);
              e.target.value = '';
            }}
            className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
          />
        </div>

        {ingestMsg && <p className="text-sm text-green-700">{ingestMsg}</p>}
      </section>

      {/* Chat */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">2. Ask a question</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask();
            }}
            placeholder="What does the document say about…?"
            className={inputClass}
          />
          <button onClick={ask} disabled={asking || !question.trim()} className={`${btnClass} shrink-0`}>
            {asking ? 'Thinking…' : 'Ask'}
          </button>
        </div>

        {answer !== null && (
          <div className="space-y-3">
            <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800">{answer}</div>
            {sources.length > 0 && (
              <div className="text-xs text-gray-500">
                <p className="font-medium text-gray-600">Sources</p>
                <ul className="mt-1 space-y-1">
                  {sources.map((s, i) => (
                    <li key={i} className="truncate">
                      {s.source}
                      {s.page != null ? ` (p.${s.page})` : ''}
                      {typeof s.score === 'number' ? ` · score ${s.score.toFixed(3)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
