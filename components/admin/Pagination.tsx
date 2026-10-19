import Link from "next/link";

export default function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex items-center justify-between text-sm"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="hover:underline">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className="hover:underline">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
