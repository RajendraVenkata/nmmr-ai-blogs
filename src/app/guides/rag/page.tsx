'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';

interface Source {
  source?: string | null;
  page?: number | null;
  score?: number;
  content?: string;
}

interface DocItem {
  source: string;
  kind: 'url' | 'pdf';
  chunks: number;
  pages: number | null;
}

interface JobView {
  id: string;
  kind: string;
  source: string;
  status: 'processing' | 'done' | 'error';
  chunks?: number | null;
  error?: string | null;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function RagAppPage() {
  const { user, loading } = useCurrentUser();
  const isCoder = !!user && canUseContainers(user.groups);

  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [k, setK] = useState(4);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [jobs, setJobs] = useState<JobView[]>([]);

  const [url, setUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; model?: string } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/rag/documents', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDocs(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!isCoder) return;
    (async () => {
      try {
        const res = await fetch('/api/rag/models', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.models)) {
          setModels(data.models);
          setModel((m) => m || data.models[0] || '');
        }
      } catch {
        /* non-fatal */
      }
      refreshDocs();
    })();
  }, [isCoder, refreshDocs]);

  // Poll a single ingestion job until it finishes; refresh the doc list on success.
  const pollJob = useCallback(
    async (id: string) => {
      for (let i = 0; i < 200; i++) {
        await sleep(1500);
        try {
          const res = await fetch(`/api/rag/jobs/${id}`, { cache: 'no-store' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) continue;
          setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...data } : j)));
          if (data.status && data.status !== 'processing') {
            if (data.status === 'done') refreshDocs();
            return;
          }
        } catch {
          /* keep polling */
        }
      }
    },
    [refreshDocs],
  );

  if (loading) return <p className="py-8">Loading…</p>;
  if (!user) {
    return (
      <p className="py-8">
        Please <Link href="/auth" className="text-primary underline">sign in</Link>.
      </p>
    );
  }
  if (!isCoder) {
    return <p className="py-8">You need Coder access to use this app.</p>;
  }

  async function ingestUrl() {
    if (!url.trim()) return;
    setError(null);
    try {
      const data = await postJson('/api/rag/ingest/url', { url: url.trim() });
      setJobs((prev) => [{ id: data.id, kind: 'url', source: data.source, status: data.status }, ...prev]);
      setUrl('');
      pollJob(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start URL ingest');
    }
  }

  async function ingestPdf(file: File) {
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const res = await fetch('/api/rag/ingest/pdf', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || `Upload failed (${res.status})`);
      setJobs((prev) => [{ id: data.id, kind: 'pdf', source: data.source, status: data.status }, ...prev]);
      pollJob(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start PDF ingest');
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const data = await postJson('/api/rag/chat', { question: question.trim(), k, model });
      setAnswer({ text: data.answer ?? '', model: data.model });
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

  const statusColor: Record<JobView['status'], string> = {
    processing: 'text-amber-600',
    done: 'text-green-700',
    error: 'text-red-600',
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-sm text-gray-500">
          <Link href="/guides" className="hover:text-gray-900">Guides</Link> / Simple RAG application
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Simple RAG application</h1>
        <p className="text-gray-600">
          Add documents to the knowledge base, then ask questions answered from that content.
          Uploads run in the background, so you can keep working and ask questions right away.
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') ingestUrl();
              }}
              placeholder="https://example.com/article"
              className={inputClass}
            />
            <button onClick={ingestUrl} disabled={!url.trim()} className={`${btnClass} shrink-0`}>
              Ingest URL
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">From a PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ingestPdf(f);
              e.target.value = '';
            }}
            className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
          />
        </div>

        {jobs.length > 0 && (
          <ul className="space-y-1 border-t border-gray-100 pt-3 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-gray-700">
                  <span className="text-gray-400">[{j.kind}]</span> {j.source}
                </span>
                <span className={`shrink-0 font-medium ${statusColor[j.status]}`}>
                  {j.status === 'processing' && 'Processing…'}
                  {j.status === 'done' && `Done · ${j.chunks} chunks`}
                  {j.status === 'error' && `Error: ${j.error ?? 'failed'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documents in context */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Documents in context</h2>
          <button onClick={refreshDocs} className="text-sm text-primary hover:underline">
            Refresh
          </button>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">No documents yet. Add a URL or PDF above.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {docs.map((d) => (
              <li key={d.source} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-gray-800">
                  <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs uppercase text-gray-500">
                    {d.kind}
                  </span>
                  {d.source}
                </span>
                <span className="shrink-0 text-gray-500">
                  {d.chunks} chunks{d.pages ? ` · ${d.pages} pages` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Chat */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">2. Ask a question</h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <label className="text-sm font-medium text-gray-700 sm:shrink-0">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={`${inputClass} sm:max-w-xs`}
            >
              {models.length === 0 && <option value="">Loading models…</option>}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 sm:shrink-0" title="Number of chunks retrieved from the vector store">
              Top-k
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={k}
              onChange={(e) => {
                const n = Number(e.target.value);
                setK(Number.isFinite(n) ? Math.min(20, Math.max(1, Math.round(n))) : 4);
              }}
              className={`${inputClass} w-20`}
            />
          </div>
        </div>

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
            <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800">{answer.text}</div>
            <div className="flex flex-wrap items-center gap-x-4 text-xs text-gray-500">
              {answer.model && <span>Model: {answer.model}</span>}
            </div>
            {sources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">
                  Retrieved chunks (top {sources.length})
                </p>
                <ol className="space-y-2">
                  {sources.map((s, i) => (
                    <li key={i} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3 text-xs text-gray-500">
                        <span className="truncate">
                          <span className="mr-1 font-semibold text-gray-700">#{i + 1}</span>
                          {s.source}
                          {s.page != null ? ` (p.${s.page})` : ''}
                        </span>
                        {typeof s.score === 'number' && (
                          <span className="shrink-0" title="Distance — lower is more similar">
                            score {s.score.toFixed(3)}
                          </span>
                        )}
                      </div>
                      {s.content && (
                        <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-gray-700">
                          {s.content}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
