'use client';

import { useCallback, useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { TERMINAL_LABS } from '@/lib/terminalEmbed';
import { relativeTimeFromSeconds } from '@/lib/format';

interface AdminRow {
  containerId: string;
  userId: string;
  labId: string;
  createdAt: number;
  running: boolean;
}

export default function AdminContainers() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [res, profiles] = await Promise.all([
        fetch('/api/admin/containers'),
        client.models.UserProfile.list({}),
      ]);
      if (!res.ok) {
        setMessage("Couldn't reach the lab service.");
        return;
      }
      const data = await res.json();
      setRows((data.containers ?? []) as AdminRow[]);
      const map: Record<string, string> = {};
      for (const p of (profiles.data ?? []) as { id: string; email?: string | null }[]) {
        if (p.email) map[p.id] = p.email;
      }
      setEmails(map);
      setMessage('');
    } catch {
      setMessage("Couldn't reach the lab service.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function stop(id: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/containers/stop', {
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

  const labLabel = (labId: string) => (TERMINAL_LABS as Record<string, string>)[labId] ?? labId;

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No active containers.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">User</th>
              <th className="py-2">Lab</th>
              <th className="py-2">Started</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.containerId} className="border-b">
                <td className="py-2">{emails[c.userId] ?? c.userId}</td>
                <td className="py-2">{labLabel(c.labId)}</td>
                <td className="py-2 text-gray-500">{relativeTimeFromSeconds(c.createdAt, Date.now())}</td>
                <td className="py-2">
                  <button
                    disabled={busy === c.containerId}
                    onClick={() => stop(c.containerId)}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                  >
                    Stop
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {message && <p className="text-sm text-red-500">{message}</p>}
    </div>
  );
}
