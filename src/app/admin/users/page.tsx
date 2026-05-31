'use client';

import RequireRole from '@/components/RequireRole';
import AdminNav from '@/components/AdminNav';
import UserTable from '@/components/UserTable';
import { canGrantRoles } from '@/lib/roles';

export default function AdminUsersPage() {
  return (
    <RequireRole allow={canGrantRoles}>
      <div>
        <h1 className="mb-2 text-2xl font-bold">Admin</h1>
        <AdminNav />
        <h2 className="mb-2 text-lg font-semibold">Users</h2>
        <UserTable />
      </div>
    </RequireRole>
  );
}
