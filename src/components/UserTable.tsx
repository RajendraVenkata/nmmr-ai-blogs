'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/client';
import { ASSIGNABLE_ROLES, type Role } from '@/lib/roles';

interface ProfileRow {
  id: string;
  email?: string | null;
  role?: string | null;
  isCoder?: boolean | null;
}

export default function UserTable() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    const { data } = await client.models.UserProfile.list({});
    setRows(data as ProfileRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(id: string, role: Role) {
    setBusy(id);
    try {
      await client.mutations.setUserRole({ userId: id, role });
      try {
        await client.models.UserProfile.update({
          id,
          role: role as 'READER' | 'CONTENT_WRITER' | 'CONTENT_ADMIN' | 'SYSTEM_ADMIN',
        });
      } catch {
        // ignore — Cognito group change is authoritative
      }
      await load();
    } finally {
      setBusy('');
    }
  }

  async function toggleCoder(id: string, enabled: boolean) {
    setBusy(id);
    try {
      await client.mutations.setCoderAccess({ userId: id, enabled });
      try {
        await client.models.UserProfile.update({ id, isCoder: enabled });
      } catch {
        // ignore — Cognito group change is authoritative
      }
      await load();
    } finally {
      setBusy('');
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="py-2">User</th>
          <th className="py-2">Role</th>
          <th className="py-2">Coder</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => (
          <tr key={u.id} className="border-b">
            <td className="py-2">{u.email ?? u.id}</td>
            <td className="py-2">
              <select
                disabled={busy === u.id}
                value={(u.role as Role) ?? 'READER'}
                onChange={(e) => changeRole(u.id, e.target.value as Role)}
                className="rounded border p-1"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </td>
            <td className="py-2">
              <input
                type="checkbox"
                disabled={busy === u.id}
                checked={!!u.isCoder}
                onChange={(e) => toggleCoder(u.id, e.target.checked)}
              />
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className="py-3 text-gray-500">No users yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
