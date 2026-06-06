'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { canUseContainers } from '@/lib/roles';

const CARD_CLASS =
  'group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md';

export default function GuidesPage() {
  const { user, loading } = useCurrentUser();
  const isCoder = !!user && canUseContainers(user.groups);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Practical guides</h1>
        <p className="text-gray-600">Hands-on guides and interactive apps you can try in the browser.</p>
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : isCoder ? (
          <Link href="/guides/rag" className={CARD_CLASS}>
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">Simple RAG application</h3>
            <p className="mt-1 text-sm text-gray-600">
              Ingest URLs and PDFs, then chat with your documents using a local Ollama model.
            </p>
            <span className="mt-3 inline-block text-sm font-medium text-primary group-hover:underline">
              Open app →
            </span>
          </Link>
        ) : (
          <p className="text-gray-500 sm:col-span-2 lg:col-span-3">More guides coming soon.</p>
        )}
      </section>
    </div>
  );
}
