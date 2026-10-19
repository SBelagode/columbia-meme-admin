const nf = new Intl.NumberFormat("en-US");

export default function UpvoteMeter({
  upvotes,
  downvotes,
}: {
  upvotes: number;
  downvotes: number;
}) {
  const total = upvotes + downvotes;
  const share = total > 0 ? upvotes / total : null;
  const pct = share === null ? null : Math.round(share * 100);

  return (
    <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm text-zinc-500 dark:text-zinc-400">Upvote share</h2>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {pct === null ? "—" : `${pct}%`}
      </div>
      <div
        role="meter"
        aria-label="Share of votes that are upvotes"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? 0}
        className="mt-3 h-2 w-full overflow-hidden rounded bg-[var(--viz-track)]"
      >
        <div
          className="h-full rounded bg-[var(--viz-series-1)]"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {nf.format(upvotes)} up · {nf.format(downvotes)} down
      </div>
    </section>
  );
}
