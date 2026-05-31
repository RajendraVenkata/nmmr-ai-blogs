'use client';

import { useState } from 'react';
import RequireRole from '@/components/RequireRole';
import { client } from '@/lib/client';
import { canGrantRoles, ASSIGNABLE_ROLES, type Role } from '@/lib/roles';

export default function AdminPage() {
  return (
    <RequireRole allow={canGrantRoles}>
      <AdminInner />
    </RequireRole>
  );
}

function AdminInner() {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role>('CONTENT_WRITER');
  const [message, setMessage] = useState('');

  async function assign() {
    setMessage('Working…');
    try {
      await client.mutations.setUserRole({ userId, role });
      setMessage(`Set ${userId} to ${role}.`);
    } catch (err) {
      setMessage(`Failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin — assign roles</h1>
      <p className="text-sm text-gray-600">
        Enter the user&apos;s Cognito username (their <code>sub</code> / user id) and pick a role.
        Roles map to Cognito groups; choosing Reader removes all elevated groups.
      </p>
      <input
        className="w-full rounded border p-2"
        placeholder="Cognito username / user id"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <select
        className="rounded border p-2"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button onClick={assign} className="rounded bg-blue-600 px-4 py-2 text-white">
        Assign role
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
