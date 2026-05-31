export default function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-block bg-black px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
      {label}
    </span>
  );
}
