'use client';

import { useState } from 'react';
import { client } from '@/lib/client';
import { requestOptions } from '@/lib/access';
import { canUseContainers } from '@/lib/roles';
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
  const options = requestOptions(user.role, canUseContainers(user.groups));
  const [value, setValue] = useState<string>(options[0]?.value ?? '');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  if (options.length === 0) return null;

  async function submit() {
    if (!value) return;
    if (pendingRoles.includes(value)) {
      setMessage('You already have a pending request for that access.');
      return;
    }
    setMessage('Submitting…');
    try {
      await client.models.AccessRequest.create({
        userId: user.userId,
        userEmail: user.email,
        requestedRole: value as 'CONTENT_WRITER' | 'CONTENT_ADMIN' | 'CODER',
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <textarea
        className="w-full rounded border p-2 text-sm"
        placeholder="Why do you need this access?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button onClick={submit} className="rounded bg-primary px-3 py-1 text-sm text-white">
        Submit request
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
