'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';
import { TERMINAL_LABS } from '@/lib/terminalEmbed';
import { relativeTimeFromSeconds } from '@/lib/format';

interface ContainerRow {
  containerId: string;
  labId: string;
  createdAt: number;
  running: boolean;
}

export default function MyContainers() {
  const { user, loading } = useCurrentUser();
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const isCoder = !!user && canUseContainers(user.groups);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/containers');
      if (!res.ok) {
        setMessage("Couldn't reach the lab service.");
        return;
      }
      const data = await res.json();
      setRows((data.containers ?? []) as ContainerRow[]);
      setMessage('');
    } catch {
      setMessage("Couldn't reach the lab service.");
    }
  }, []);

  useEffect(() => {
    if (isCoder) load();
  }, [isCoder, load]);

  async function stop(id: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/containers/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId: id }),
      });
      if (res.ok) {
        await load();
      } else {
        setMessage('Could not stop the container.');
      }
    } catch {
      setMessage('Could not stop the container.');
    } finally {
      setBusy('');
    }
  }

  if (loading || !isCoder) return null;

  const labLabel = (labId: string) => (TERMINAL_LABS as Record<string, string>)[labId] ?? labId;

  return (
    <div className="space-y-2">
      <h2 className="font-semibold">My containers</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No active containers.</p>
      ) : (
        <ul className="divide-y rounded border">
          {rows.map((c) => (
            <li key={c.containerId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {labLabel(c.labId)}{' '}
                <span className="text-gray-500">· started {relativeTimeFromSeconds(c.createdAt, Date.now())}</span>
              </span>
              <button
                disabled={busy === c.containerId}
                onClick={() => stop(c.containerId)}
                className="rounded bg-red-600 px-2 py-1 text-xs text-white"
              >
                Stop
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="text-sm text-red-500">{message}</p>}
    </div>
  );
}
