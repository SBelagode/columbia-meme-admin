const nf = new Intl.NumberFormat("en-US");
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// Day keys are calendar dates; parse at noon UTC so formatting never shifts.
function parseDay(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

const PLOT_HEIGHT = 112; // px

// Single-series column chart in plain CSS: 24px max columns, 4px rounded
// caps, value on the cap, per-column hover tooltip, and a table view.
export default function ActivityChart({
  title,
  unit,
  data,
}: {
  title: string;
  unit: string;
  data: { day: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {nf.format(total)} total
        </span>
      </div>

      <div
        className="mt-6 flex items-end gap-0.5 border-b border-zinc-200 dark:border-zinc-800"
        style={{ height: PLOT_HEIGHT }}
        aria-hidden="true"
      >
        {data.map(({ day, value }) => {
          const date = parseDay(day);
          const height = Math.round((value / max) * (PLOT_HEIGHT - 20));
          return (
            <div
              key={day}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
            >
              <span className="mb-1 text-xs text-zinc-600 tabular-nums dark:text-zinc-400">
                {value > 0 ? nf.format(value) : ""}
              </span>
              <div
                className="w-full max-w-6 rounded-t bg-[var(--viz-series-1)] group-hover:opacity-80"
                style={{ height }}
              />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm group-hover:block dark:border-zinc-700 dark:bg-zinc-900">
                <div className="text-zinc-500 dark:text-zinc-400">
                  {weekday.format(date)}, {monthDay.format(date)}
                </div>
                <div className="font-medium tabular-nums">
                  {nf.format(value)} {unit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5" aria-hidden="true">
        {data.map(({ day }) => (
          <span
            key={day}
            className="flex-1 text-center text-xs text-zinc-500 dark:text-zinc-400"
          >
            {weekday.format(parseDay(day))}
          </span>
        ))}
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">
          Table view
        </summary>
        <table className="mt-2 w-full tabular-nums">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-zinc-500 dark:text-zinc-400">
              <th className="py-1 font-normal">Day</th>
              <th className="py-1 text-right font-normal">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ day, value }) => (
              <tr key={day} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="py-1">
                  {weekday.format(parseDay(day))}, {monthDay.format(parseDay(day))}
                </td>
                <td className="py-1 text-right">{nf.format(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
