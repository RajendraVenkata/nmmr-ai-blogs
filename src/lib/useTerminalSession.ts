'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';
import type { LabId } from '@/lib/terminalEmbed';
import '@xterm/xterm/css/xterm.css';

export type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'error';

/** Shared xterm + WebSocket + Coder-gating logic for inline and floating terminals. */
export function useTerminalSession(labId: LabId) {
  const { user, loading } = useCurrentUser();
  const [status, setStatus] = useState<TerminalStatus>('idle');
  const [message, setMessage] = useState('');
  const mountRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<{ dispose: () => void } | null>(null);
  const fitRef = useRef<{ fit: () => void } | null>(null);
  const launchingRef = useRef(false);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const resizeRafRef = useRef(0);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      termRef.current?.dispose();
      resizeObsRef.current?.disconnect();
      cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  async function launch() {
    if (!mountRef.current || launchingRef.current) return;
    launchingRef.current = true;
    setStatus('connecting');
    setMessage('Connecting…');
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) {
        setStatus('error');
        setMessage('Please sign in to launch a terminal.');
        return;
      }

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const term = new Terminal({ cursorBlink: true, fontSize: 13, convertEol: true });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      mountRef.current.innerHTML = '';
      term.open(mountRef.current);
      fitAddon.fit();
      termRef.current = term;
      fitRef.current = fitAddon;

      // Auto-refit xterm whenever its container changes size (manual resize, restore).
      resizeObsRef.current?.disconnect();
      const obs = new ResizeObserver(() => {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = requestAnimationFrame(() => fitAddon.fit());
      });
      obs.observe(mountRef.current);
      resizeObsRef.current = obs;

      const base = process.env.NEXT_PUBLIC_TERMINAL_WS_URL ?? 'ws://localhost:8080';
      const ws = new WebSocket(`${base}?token=${encodeURIComponent(token)}&labId=${encodeURIComponent(labId)}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      launchingRef.current = false;

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
      launchingRef.current = false;
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Failed to launch');
    }
  }

  /** Re-fit the terminal to its container (call after a hidden→visible transition). */
  function refit() {
    fitRef.current?.fit();
  }

  const isCoder = !!user && canUseContainers(user.groups);

  return { loading, isCoder, status, message, mountRef, launch, refit };
}
