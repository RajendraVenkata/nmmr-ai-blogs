export default function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
      {label}
    </span>
  );
}
