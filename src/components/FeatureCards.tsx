import Link from 'next/link';

const FEATURES: { title: string; body: string; href?: string }[] = [
  { title: 'Practical guides', body: 'Step-by-step articles you can actually apply.', href: '/guides' },
  { title: 'From practitioners', body: 'Written by people shipping real systems.' },
  { title: 'Always current', body: 'Fresh takes on AI, infrastructure, and engineering.' },
];

const CARD_CLASS = 'rounded-xl border border-gray-200 bg-white p-6 shadow-sm';

export default function FeatureCards() {
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {FEATURES.map((f) => {
        const inner = (
          <>
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">{f.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{f.body}</p>
          </>
        );

        return f.href ? (
          <Link
            key={f.title}
            href={f.href}
            className={`${CARD_CLASS} block transition hover:border-primary/40 hover:shadow-md`}
          >
            {inner}
          </Link>
        ) : (
          <div key={f.title} className={CARD_CLASS}>
            {inner}
          </div>
        );
      })}
    </section>
  );
}
