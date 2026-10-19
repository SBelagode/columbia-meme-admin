import type { GenerationSpotlight } from "@/lib/admin/dashboard";
import { DASHBOARD_TIME_ZONE } from "@/lib/admin/dates";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: DASHBOARD_TIME_ZONE,
});

export default function SpotlightCard({
  title,
  description,
  generation,
  emptyMessage,
}: {
  title: string;
  description: string;
  generation: GenerationSpotlight | null;
  emptyMessage: string;
}) {
  return (
    <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>

      {!generation ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-4 flex gap-3">
          {generation.imageUrl && (
            // Supabase Storage public URL; plain <img> avoids remote image config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={generation.imageUrl}
              alt=""
              className="h-20 w-20 shrink-0 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="line-clamp-3 text-sm">
              {generation.generatedText ?? "(no caption)"}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {generation.creatorName ?? "Unknown user"} ·{" "}
              {dateFormat.format(new Date(generation.createdAt))}
            </p>
            <p className="mt-2 text-xs tabular-nums">
              <span className="font-medium">
                Score {generation.score > 0 ? "+" : ""}
                {generation.score}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {" "}
                · {generation.upvotes} up · {generation.downvotes} down
              </span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
