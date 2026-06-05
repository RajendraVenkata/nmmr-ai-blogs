export interface RelayResponse {
  status: number;
  body: unknown;
}

/** Server-to-server call to the relay's HTTP API with a bearer token. */
export async function proxyToRelay(
  path: string,
  opts: { method: 'GET' | 'POST'; token: string; body?: unknown },
): Promise<RelayResponse> {
  const base = process.env.TERMINAL_HTTP_URL ?? 'http://localhost:8080';
  try {
    const res = await fetch(`${base}${path}`, {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch {
    return { status: 502, body: { error: 'Could not reach the lab service' } };
  }
}
