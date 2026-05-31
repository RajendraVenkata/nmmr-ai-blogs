'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import RequestQueue from '@/components/RequestQueue';
import { canGrantRoles } from '@/lib/roles';

export default function AdminRequestsPage() {
  return (
    <RequireRole allow={canGrantRoles}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Access requests</h2>
        <RequestQueue />
      </div>
    </RequireRole>
  );
}
