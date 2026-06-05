'use client';

import { requestLabel } from '@/lib/access';

export interface RequestRow {
  id: string;
  requestedRole?: string | null;
  status?: string | null;
  reason?: string | null;
}

export default function MyRequests({ requests }: { requests: RequestRow[] }) {
  if (requests.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">My requests</h2>
      <ul className="divide-y rounded border">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{requestLabel(r.requestedRole ?? '')}</span>
            <span className="text-gray-500">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
