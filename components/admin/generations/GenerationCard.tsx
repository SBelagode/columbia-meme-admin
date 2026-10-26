import Link from "next/link";
import Avatar from "@/components/admin/Avatar";
import CopyButton from "@/components/admin/CopyButton";
import GenerationEditor from "@/components/admin/generations/GenerationEditor";
import DeleteGenerationButton from "@/components/admin/generations/DeleteGenerationButton";
import { DASHBOARD_TIME_ZONE } from "@/lib/admin/dates";
import { buildHref, shortId } from "@/lib/admin/params";

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DASHBOARD_TIME_ZONE,
});

export type GenerationItem = {
  id: number;
  userId: string;
  creatorName: string | null;
  creatorAvatar: string | null;
  generatedText: string | null;
  userPrompt: string | null;
  generationPrompt: string | null;
  imageUrl: string | null;
  createdAt: string;
  /** Set for generations recorded through the new request pipeline. */
  modelName: string | null;
  requestId: string | null;
  upvotes: number;
  downvotes: number;
};

export default function GenerationCard({ g }: { g: GenerationItem }) {
  const score = g.upvotes - g.downvotes;
  const total = g.upvotes + g.downvotes;
  const createdLabel = timeFormat.format(new Date(g.createdAt));

  return (
    <li className="flex gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      {g.imageUrl ? (
        // Supabase Storage public URL; plain <img> avoids remote image config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={g.imageUrl}
          alt=""
          loading="lazy"
          className="h-24 w-24 shrink-0 rounded bg-zinc-100 object-cover sm:h-28 sm:w-28 dark:bg-zinc-800"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 text-center text-xs text-zinc-400 sm:h-28 sm:w-28 dark:border-zinc-700 dark:text-zinc-500">
          No image
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <GenerationEditor
          id={g.id}
          generatedText={g.generatedText}
          generationPrompt={g.generationPrompt}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Link
            href={buildHref("/admin/generations", { user: g.userId })}
            title="All generations by this user"
            className="flex items-center gap-1.5 hover:underline"
          >
            <Avatar src={g.creatorAvatar} name={g.creatorName ?? ""} size={20} />
            {g.creatorName ? (
              <span className="text-zinc-700 dark:text-zinc-300">{g.creatorName}</span>
            ) : (
              <span className="font-mono" title={g.userId}>
                {shortId(g.userId)}
              </span>
            )}
          </Link>
          <time dateTime={g.createdAt}>{createdLabel}</time>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
          <span className="rounded border border-zinc-300 px-1.5 py-0.5 font-medium dark:border-zinc-700">
            Score {score > 0 ? "+" : ""}
            {score}
          </span>
          {total > 0 ? (
            <Link
              href={buildHref("/admin/votes", { generation: g.id })}
              className="text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {total} {total === 1 ? "vote" : "votes"} · {g.upvotes} up · {g.downvotes} down →
            </Link>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">0 votes</span>
          )}
        </div>

        <div>
          <DeleteGenerationButton
            id={g.id}
            imageUrl={g.imageUrl}
            text={g.generatedText}
            creator={g.creatorName ?? shortId(g.userId)}
            createdLabel={createdLabel}
            voteCount={total}
          />
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">
            Details
          </summary>
          <dl className="mt-2 grid gap-2">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">User prompt</dt>
              <dd className="whitespace-pre-line">{g.userPrompt || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Generation prompt</dt>
              <dd className="max-h-40 overflow-y-auto whitespace-pre-line">
                {g.generationPrompt || "—"}
              </dd>
            </div>
            {(g.modelName || g.requestId) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {g.modelName && (
                  <span>
                    <span className="text-zinc-500 dark:text-zinc-400">Model </span>
                    {g.modelName}
                  </span>
                )}
                {g.requestId && (
                  <Link
                    href={buildHref("/admin/llm-responses", { request: g.requestId })}
                    className="underline-offset-2 hover:underline"
                  >
                    <span className="text-zinc-500 dark:text-zinc-400">Request </span>
                    <span className="font-mono">{shortId(g.requestId)}</span> →
                  </Link>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <span className="text-zinc-500 dark:text-zinc-400">Generation ID </span>
                <span className="font-mono">{shortId(g.id)}</span>{" "}
                <CopyButton value={String(g.id)} label="Copy" />
              </span>
              <span>
                <span className="text-zinc-500 dark:text-zinc-400">Creator ID </span>
                <span className="font-mono">{shortId(g.userId)}</span>{" "}
                <CopyButton value={g.userId} label="Copy" />
              </span>
            </div>
          </dl>
        </details>
      </div>
    </li>
  );
}
