'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { pendingRequests } from '@/lib/access';

interface RequestRow {
  id: string;
  userId: string;
  userEmail?: string | null;
  requestedRole?: string | null;
  reason?: string | null;
  status?: string | null;
}

export default function RequestQueue() {
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    const { data } = await client.models.AccessRequest.list({
      filter: { status: { eq: 'PENDING' } },
    });
    setRows(pendingRequests(data as RequestRow[]));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(r: RequestRow) {
    if (!r.requestedRole) return;
    setBusy(r.id);
    try {
      await client.mutations.setUserRole({ userId: r.userId, role: r.requestedRole });
      await client.models.AccessRequest.update({
        id: r.id,
        status: 'APPROVED',
        decidedBy: user?.email ?? '',
        decidedAt: new Date().toISOString(),
      });
      try {
        await client.models.UserProfile.update({
          id: r.userId,
          role: r.requestedRole as 'CONTENT_WRITER' | 'CONTENT_ADMIN',
        });
      } catch {
        // ignore — Cognito group change is the authoritative grant
      }
      await load();
    } finally {
      setBusy('');
    }
  }

  async function reject(r: RequestRow) {
    setBusy(r.id);
    try {
      await client.models.AccessRequest.update({
        id: r.id,
        status: 'REJECTED',
        decidedBy: user?.email ?? '',
        decidedAt: new Date().toISOString(),
      });
      await load();
    } finally {
      setBusy('');
    }
  }

  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id} className="py-3 text-sm">
          <div className="font-medium">{r.userEmail ?? r.userId}</div>
          <div className="text-gray-600">Wants: {r.requestedRole}</div>
          {r.reason && <div className="text-gray-500">Reason: {r.reason}</div>}
          <div className="mt-1 flex gap-3">
            <button
              disabled={busy === r.id}
              onClick={() => approve(r)}
              className="rounded bg-green-600 px-2 py-1 text-xs text-white"
            >
              Approve
            </button>
            <button
              disabled={busy === r.id}
              onClick={() => reject(r)}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white"
            >
              Reject
            </button>
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="py-3 text-sm text-gray-500">No pending requests.</li>}
    </ul>
  );
}
