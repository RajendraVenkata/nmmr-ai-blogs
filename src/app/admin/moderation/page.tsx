'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import ModerationList from '@/components/ModerationList';
import { canModerate } from '@/lib/roles';

export default function AdminModerationPage() {
  return (
    <RequireRole allow={canModerate}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Moderation</h2>
        <ModerationList />
      </div>
    </RequireRole>
  );
}
