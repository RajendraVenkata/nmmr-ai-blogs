import { formatDate } from '@/lib/format';

export default function PostMeta({
  authorName,
  date,
}: {
  authorName?: string | null;
  date?: string | null;
}) {
  const d = formatDate(date);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
      {authorName && (
        <span>
          by <span className="font-medium text-gray-700">{authorName}</span>
        </span>
      )}
      {d && (
        <span className="flex items-center gap-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {d}
        </span>
      )}
    </p>
  );
}
