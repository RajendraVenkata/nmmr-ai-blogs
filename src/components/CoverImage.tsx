'use client';

import { useEffect, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';

export default function CoverImage({
  coverKey,
  label,
  className = '',
}: {
  coverKey?: string | null;
  label: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (coverKey) {
      getUrl({ path: coverKey })
        .then(({ url }) => {
          if (active) setUrl(url.toString());
        })
        .catch(() => {
          if (active) setUrl(null);
        });
    } else {
      setUrl(null);
    }
    return () => {
      active = false;
    };
  }, [coverKey]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={label} className={`${className} object-cover`} />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-600`}
    >
      <span className="text-sm font-bold uppercase tracking-wide text-white/80">{label}</span>
    </div>
  );
}
