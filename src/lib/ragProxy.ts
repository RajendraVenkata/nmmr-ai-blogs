export interface RagResponse {
  status: number;
  body: unknown;
}

const RAG_BASE = process.env.RAG_API_URL ?? 'http://localhost:8000';

/** Optional bearer the backend expects (RAG_API_KEY). Kept server-side only. */
function ragAuthHeader(): Record<string, string> {
  const key = process.env.RAG_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/** Server-to-server JSON call to the rag-backends API. */
export async function proxyToRag(
  path: string,
  opts: { method: 'GET' | 'POST'; body?: unknown },
): Promise<RagResponse> {
  try {
    const res = await fetch(`${RAG_BASE}${path}`, {
      method: opts.method,
      headers: {
        ...ragAuthHeader(),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch {
    return { status: 502, body: { error: 'Could not reach the RAG service' } };
  }
}

/** Server-to-server multipart upload (PDF ingest) to the rag-backends API. */
export async function uploadToRag(path: string, form: FormData): Promise<RagResponse> {
  try {
    const res = await fetch(`${RAG_BASE}${path}`, {
      method: 'POST',
      headers: ragAuthHeader(), // let fetch set the multipart boundary
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch {
    return { status: 502, body: { error: 'Could not reach the RAG service' } };
  }
}
