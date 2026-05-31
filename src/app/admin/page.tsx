'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/requests');
  }, [router]);
  return <p className="py-8">Redirecting…</p>;
}
