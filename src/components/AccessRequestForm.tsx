'use client';

import { useState } from 'react';
import { client } from '@/lib/client';
import { requestableRoles, type RequestableRole } from '@/lib/access';
import type { CurrentUser } from '@/lib/useCurrentUser';

export default function AccessRequestForm({
  user,
  pendingRoles,
  onSubmitted,
}: {
  user: CurrentUser;
  pendingRoles: string[];
  onSubmitted: () => void;
}) {
  const options = requestableRoles(user.role);
  const [role, setRole] = useState<RequestableRole | ''>(options[0] ?? '');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  if (options.length === 0) return null;

  async function submit() {
    if (!role) return;
    if (pendingRoles.includes(role)) {
      setMessage('You already have a pending request for that role.');
      return;
    }
    setMessage('Submitting…');
    try {
      await client.models.AccessRequest.create({
        userId: user.userId,
        userEmail: user.email,
        requestedRole: role,
        reason,
        status: 'PENDING',
      });
      setReason('');
      setMessage('Request submitted.');
      onSubmitted();
    } catch (err) {
      setMessage(`Failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-2 rounded border p-4">
      <h2 className="font-semibold">Request access</h2>
      <select
        className="rounded border p-2"
        value={role}
        onChange={(e) => setRole(e.target.value as RequestableRole)}
      >
        {options.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <textarea
        className="w-full rounded border p-2 text-sm"
        placeholder="Why do you need this access?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button onClick={submit} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">
        Submit request
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
