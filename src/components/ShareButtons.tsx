'use client';

import { linkedInShareUrl, xShareUrl, facebookShareUrl } from '@/lib/share';

export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const payload = { url, title };
  const links = [
    { label: 'LinkedIn', href: linkedInShareUrl(payload) },
    { label: 'X', href: xShareUrl(payload) },
    { label: 'Facebook', href: facebookShareUrl(payload) },
  ];
  return (
    <div className="flex gap-3 py-4 text-sm">
      <span className="text-gray-500">Share:</span>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
           className="text-blue-600 underline">
          {l.label}
        </a>
      ))}
    </div>
  );
}
