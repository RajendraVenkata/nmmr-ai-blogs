'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';
import { TERMINAL_LABS, type LabId } from '@/lib/terminalEmbed';
import '@xterm/xterm/css/xterm.css';

type Status = 'idle' | 'connecting' | 'connected' | 'error';

export default function TerminalEmbed({ labId }: { labId: LabId }) {
  const { user, loading } = useCurrentUser();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const mountRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, []);

  async function launch() {
    if (!mountRef.current) return;
    setStatus('connecting');
    setMessage('Requesting access…');
    try {
      const res = await fetch('/api/terminal-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed' }));
        setStatus('error');
        setMessage(error ?? `Request failed (${res.status})`);
        return;
      }
      const { token } = await res.json();

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const term = new Terminal({ cursorBlink: true, fontSize: 13, convertEol: true });
      const fit = new FitAddon();
      term.loadAddon(fit);
      mountRef.current.innerHTML = '';
      term.open(mountRef.current);
      fit.fit();
      termRef.current = term;

      const base = process.env.NEXT_PUBLIC_TERMINAL_WS_URL ?? 'ws://localhost:8080';
      const ws = new WebSocket(`${base}?token=${encodeURIComponent(token)}&labId=${encodeURIComponent(labId)}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'ready') { setStatus('connected'); setMessage(''); }
            else if (msg.type === 'error') { setStatus('error'); setMessage(msg.message ?? 'Error'); }
            else if (msg.type === 'system') { term.writeln(`\r\n\x1b[33m${msg.message}\x1b[0m`); }
            // activity_ack / pong: ignore
            return;
          } catch {
            term.write(ev.data);
            return;
          }
        }
        term.write(new Uint8Array(ev.data as ArrayBuffer));
      };
      ws.onclose = () => setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      ws.onerror = () => { setStatus('error'); setMessage('Connection failed'); };

      term.onData((d) => { if (ws.readyState === WebSocket.OPEN) ws.send(d); });
      ws.onopen = () => { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); };
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Failed to launch');
    }
  }

  const label = TERMINAL_LABS[labId];

  if (loading) {
    return <div className="my-4 rounded border bg-gray-50 p-4 text-sm text-gray-500">Loading…</div>;
  }

  if (!user || !canUseContainers(user.groups)) {
    return (
      <div className="my-4 rounded border bg-gray-50 p-4 text-sm">
        <p className="font-medium">{label} terminal</p>
        <p className="mt-1 text-gray-600">
          Coder access is required to run this terminal.{' '}
          <a href="/account" className="text-indigo-600 underline">Request access</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 rounded border bg-black p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-gray-300">{label} terminal</span>
        {status === 'idle' && (
          <button onClick={launch} className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
            Launch
          </button>
        )}
        {status === 'connecting' && <span className="text-xs text-gray-400">{message || 'Connecting…'}</span>}
        {status === 'error' && (
          <button onClick={launch} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white">
            Retry
          </button>
        )}
      </div>
      {status === 'error' && <p className="px-1 pb-2 text-xs text-red-400">{message}</p>}
      <div ref={mountRef} style={{ minHeight: status === 'idle' ? 0 : 300 }} />
    </div>
  );
}
