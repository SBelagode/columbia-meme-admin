import Link from "next/link";

// Shows an active cross-navigation filter with a link to remove it.
export default function FilterChip({
  label,
  value,
  clearHref,
}: {
  label: string;
  value: React.ReactNode;
  clearHref: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded border border-zinc-300 py-1 pr-1 pl-2 text-sm dark:border-zinc-700">
      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
      <Link
        href={clearHref}
        aria-label={`Remove ${label.toLowerCase()} filter`}
        className="shrink-0 rounded px-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        ×
      </Link>
    </span>
  );
}
