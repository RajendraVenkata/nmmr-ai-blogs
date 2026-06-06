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
  label: string;
  status: 'processing' | 'done' | 'error';
  result?: { chunks?: number; source?: string } | null;
  error?: string | null;
}

interface ChatResult {
  answer?: string;
  provider?: string;
  model?: string;
  sources?: Source[];
}

interface ModelOption {
  provider: string;
  model: string;
}

interface RagConfig {
  embedding: { provider: string; model: string };
  has_openai_key: boolean;
  embedding_options: { ollama: string[]; openai: string[] };
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

  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelIdx, setModelIdx] = useState(0);
  const [k, setK] = useState(4);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [jobs, setJobs] = useState<JobView[]>([]);

  // Settings (embeddings + OpenAI key)
  const [config, setConfig] = useState<RagConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [embProvider, setEmbProvider] = useState('ollama');
  const [embModel, setEmbModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const [url, setUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; provider?: string; model?: string } | null>(null);
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

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch('/api/rag/models', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.models)) {
        setModels(data.models);
        setModelIdx(0);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/rag/config', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as RagConfig;
      if (res.ok && data.embedding) {
        setConfig(data);
        setEmbProvider(data.embedding.provider);
        setEmbModel(data.embedding.model);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!isCoder) return;
    loadConfig();
    loadModels();
    refreshDocs();
  }, [isCoder, loadConfig, loadModels, refreshDocs]);

  // Poll a job until it finishes. Each poll is a short request, so an upstream
  // gateway never times out (504) on a slow Ollama/OpenAI call. Returns the final job.
  const waitForJob = useCallback(
    async (id: string, intervalMs = 1200, maxTries = 250): Promise<JobView> => {
      for (let i = 0; i < maxTries; i++) {
        await sleep(intervalMs);
        try {
          const res = await fetch(`/api/rag/jobs/${id}`, { cache: 'no-store' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) continue;
          if (data.status && data.status !== 'processing') return data as JobView;
        } catch {
          /* keep polling */
        }
      }
      throw new Error('Timed out waiting for the result');
    },
    [],
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

  const embOptions = config?.embedding_options?.[embProvider as 'ollama' | 'openai'] ?? [];

  async function saveConfig() {
    setSavingCfg(true);
    setError(null);
    setCfgMsg(null);
    try {
      const body: Record<string, string> = {
        embedding_provider: embProvider,
        embedding_model: embModel,
      };
      if (apiKey.trim()) body.openai_api_key = apiKey.trim();
      const embedChanged =
        config &&
        (config.embedding.provider !== embProvider || config.embedding.model !== embModel);
      const data = (await postJson('/api/rag/config', body)) as RagConfig;
      setConfig(data);
      setApiKey('');
      await Promise.all([loadModels(), refreshDocs()]);
      if (embedChanged) {
        setJobs([]);
        setAnswer(null);
        setSources([]);
        setCfgMsg('Embedding model changed — the knowledge base was cleared. Re-ingest your documents.');
      } else {
        setCfgMsg('Settings saved.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSavingCfg(false);
    }
  }

  async function clearStore() {
    if (!window.confirm('Clear the entire knowledge base? All ingested URLs and PDFs will be removed.')) {
      return;
    }
    setClearing(true);
    setError(null);
    try {
      await postJson('/api/rag/clear', {});
      setJobs([]);
      setAnswer(null);
      setSources([]);
      await refreshDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear');
    } finally {
      setClearing(false);
    }
  }

  // Track an ingest job in the list, then poll it to completion.
  async function trackIngest(job: JobView) {
    setJobs((prev) => [job, ...prev]);
    try {
      const done = await waitForJob(job.id);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, ...done } : j)));
      if (done.status === 'done') refreshDocs();
    } catch {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: 'Timed out' } : j)),
      );
    }
  }

  async function ingestUrl() {
    if (!url.trim()) return;
    setError(null);
    try {
      const data = await postJson('/api/rag/ingest/url', { url: url.trim() });
      setUrl('');
      trackIngest({ id: data.id, kind: 'url', label: data.label, status: 'processing' });
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
      trackIngest({ id: data.id, kind: 'pdf', label: data.label, status: 'processing' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start PDF ingest');
    }
  }

  async function ask() {
    if (!question.trim()) return;
    const sel = models[modelIdx];
    if (!sel) {
      setError('No chat model available — check Settings / Ollama.');
      return;
    }
    setAsking(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const job = await postJson('/api/rag/chat', {
        question: question.trim(),
        k,
        provider: sel.provider,
        model: sel.model,
      });
      const done = await waitForJob(job.id, 1000, 300);
      if (done.status === 'error') throw new Error(done.error || 'Chat failed');
      const result = (done.result ?? {}) as ChatResult;
      setAnswer({ text: result.answer ?? '', provider: result.provider, model: result.model });
      setSources(Array.isArray(result.sources) ? result.sources : []);
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

      {/* Settings */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className="flex w-full items-center justify-between p-6 text-left"
        >
          <span className="text-lg font-semibold text-gray-900">Settings — embeddings &amp; API key</span>
          <span className="text-sm text-gray-500">
            {config ? `${config.embedding.provider} · ${config.embedding.model}` : '…'} {settingsOpen ? '▲' : '▼'}
          </span>
        </button>
        {settingsOpen && (
          <div className="space-y-4 border-t border-gray-100 p-6">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Changing the embedding provider/model rebuilds the vector store, so the current
              knowledge base is <strong>cleared</strong> and must be re-ingested.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Embedding provider</label>
                <select
                  value={embProvider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setEmbProvider(p);
                    const opts = config?.embedding_options?.[p as 'ollama' | 'openai'] ?? [];
                    setEmbModel(opts[0] ?? '');
                  }}
                  className={inputClass}
                >
                  <option value="ollama">Ollama (local)</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Embedding model</label>
                <select value={embModel} onChange={(e) => setEmbModel(e.target.value)} className={inputClass}>
                  {embOptions.length === 0 && <option value="">No models</option>}
                  {embOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                OpenAI API key{' '}
                <span className="font-normal text-gray-400">
                  ({config?.has_openai_key ? 'set — leave blank to keep' : 'not set'}; used for OpenAI embeddings and chat)
                </span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
                className={inputClass}
              />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={saveConfig} disabled={savingCfg} className={btnClass}>
                {savingCfg ? 'Saving…' : 'Save settings'}
              </button>
              {cfgMsg && <span className="text-sm text-green-700">{cfgMsg}</span>}
            </div>
          </div>
        )}
      </section>

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
                  <span className="text-gray-400">[{j.kind}]</span> {j.label}
                </span>
                <span className={`shrink-0 font-medium ${statusColor[j.status]}`}>
                  {j.status === 'processing' && 'Processing…'}
                  {j.status === 'done' && `Done · ${j.result?.chunks ?? 0} chunks`}
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
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Documents in context</h2>
            {config && (
              <span
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                title="Embedding model the stored vectors were built with. Changing it (in Settings) clears the store."
              >
                embeddings: {config.embedding.provider} · {config.embedding.model}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={refreshDocs} className="text-sm text-primary hover:underline">
              Refresh
            </button>
            <button
              onClick={clearStore}
              disabled={clearing || docs.length === 0}
              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-40"
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>
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
              value={modelIdx}
              onChange={(e) => setModelIdx(Number(e.target.value))}
              className={`${inputClass} sm:max-w-xs`}
            >
              {models.length === 0 && <option value={0}>No models available</option>}
              {models.map((m, i) => (
                <option key={`${m.provider}:${m.model}`} value={i}>
                  {m.provider} · {m.model}
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
              {answer.model && <span>Model: {answer.provider} · {answer.model}</span>}
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
