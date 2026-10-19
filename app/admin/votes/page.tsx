import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { DASHBOARD_TIME_ZONE } from "@/lib/admin/dates";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import Avatar from "@/components/admin/Avatar";
import CopyButton from "@/components/admin/CopyButton";
import FilterChip from "@/components/admin/FilterChip";
import {
  buildHref,
  firstParam,
  parsePageParam,
  parseBigintIdParam,
  parseUserIdParam,
  shortId,
  type SearchParams,
} from "@/lib/admin/params";

const PAGE_SIZE = 50;

type VoteFilter = "all" | "up" | "down";
type Filters = { type: VoteFilter; generation: string | null; user: string | null };

type VoteRow = {
  id: number;
  vote_value: number;
  created_at: string;
  user_id: string;
  generation_id: number;
  generations: {
    generated_text: string | null;
    source_image_url: string | null;
  } | null;
};

type Voter = { name: string | null; avatar: string | null };

const FILTERS: { value: VoteFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "up", label: "Upvotes" },
  { value: "down", label: "Downvotes" },
];

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DASHBOARD_TIME_ZONE,
});
const nf = new Intl.NumberFormat("en-US");

function parseFilters(params: SearchParams): Filters {
  const raw = firstParam(params.type);
  return {
    type: raw === "up" || raw === "down" ? raw : "all",
    // Cross-navigation from generations (?generation=) and profiles (?user=).
    generation: parseBigintIdParam(params.generation),
    user: parseUserIdParam(params.user),
  };
}

function href(filters: Filters, page = 1) {
  return buildHref("/admin/votes", {
    type: filters.type === "all" ? null : filters.type,
    generation: filters.generation,
    user: filters.user,
    page: page > 1 ? page : null,
  });
}

function VoteValue({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-zinc-300 px-1.5 py-0.5 text-xs font-medium dark:border-zinc-700">
        <span aria-hidden="true">▲</span> Upvote
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-dashed border-zinc-400 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">
        <span aria-hidden="true">▼</span> Downvote
      </span>
    );
  }
  return <span className="text-xs text-zinc-500">Value {value}</span>;
}

function GenerationRef({ vote }: { vote: VoteRow }) {
  const g = vote.generations;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {g?.source_image_url ? (
        // Supabase Storage public URL; plain <img> avoids remote image config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={g.source_image_url}
          alt=""
          loading="lazy"
          className="h-8 w-8 shrink-0 rounded bg-zinc-100 object-cover dark:bg-zinc-800"
        />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded border border-dashed border-zinc-300 dark:border-zinc-700" />
      )}
      <div className="min-w-0">
        <Link
          href={buildHref("/admin/generations", { id: vote.generation_id })}
          title={g?.generated_text ?? "View generation"}
          className="line-clamp-1 text-sm hover:underline"
        >
          {g?.generated_text?.trim() || (
            <span className="text-zinc-400 dark:text-zinc-500">
              {g ? "(no text)" : "(generation unavailable)"}
            </span>
          )}
        </Link>
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400" title={String(vote.generation_id)}>
          {shortId(vote.generation_id)}
        </p>
      </div>
    </div>
  );
}

function VoterRef({ userId, voter }: { userId: string; voter: Voter | undefined }) {
  return (
    <Link
      href={buildHref("/admin/votes", { user: userId })}
      title="All votes by this user"
      className="flex min-w-0 items-center gap-1.5 hover:underline"
    >
      <Avatar src={voter?.avatar ?? null} name={voter?.name ?? ""} size={20} />
      {voter?.name ? (
        <span className="truncate text-sm">{voter.name}</span>
      ) : (
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400" title={userId}>
          {shortId(userId)}
        </span>
      )}
    </Link>
  );
}

async function VotesContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase } = await requireSuperadmin();
  const params = await searchParams;
  const filters = parseFilters(params);
  const { type } = filters;
  const page = parsePageParam(params);
  const from = (page - 1) * PAGE_SIZE;

  // Read-only. Superadmin RLS policies decide what votes, generations and
  // profiles return.
  let query = supabase
    .from("votes")
    .select(
      "id, vote_value, created_at, user_id, generation_id, generations(generated_text, source_image_url)",
      { count: "exact" },
    );
  if (filters.generation) query = query.eq("generation_id", filters.generation);
  if (filters.user) query = query.eq("user_id", filters.user);
  if (type === "up") query = query.gt("vote_value", 0);
  if (type === "down") query = query.lt("vote_value", 0);

  // Per-tab totals (head-only count queries), scoped to the same
  // generation/user filters as the list.
  const base = () => {
    let q = supabase.from("votes").select("*", { count: "exact", head: true });
    if (filters.generation) q = q.eq("generation_id", filters.generation);
    if (filters.user) q = q.eq("user_id", filters.user);
    return q;
  };
  const countOf = (filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>) =>
    filter(base()).then(({ count, error }) => (error ? null : (count ?? 0)));

  const [{ data, count, error }, allCount, upCount, downCount] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE_SIZE - 1),
    countOf((q) => q),
    countOf((q) => q.gt("vote_value", 0)),
    countOf((q) => q.lt("vote_value", 0)),
  ]);

  if (error) {
    console.error("[admin/votes]", error.code, error.message);
    return (
      <p className="rounded border border-red-300 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
        Could not load votes. Please try again.
      </p>
    );
  }

  const votes = (data ?? []) as unknown as VoteRow[];

  // Include the filtered user so the chip can show a name even with no rows.
  const userIds = [
    ...new Set([...votes.map((v) => v.user_id), ...(filters.user ? [filters.user] : [])]),
  ];
  const voters = new Map<string, Voter>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", userIds);
    if (profileError) {
      console.error("[admin/votes] profiles", profileError.code, profileError.message);
    }
    for (const p of profiles ?? []) {
      voters.set(p.id, {
        name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null,
        avatar: p.avatar_url,
      });
    }
  }

  const counts: Record<VoteFilter, number | null> = {
    all: allCount,
    up: upCount,
    down: downCount,
  };
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Caption for the generation chip (one small lookup, only when filtered).
  let generationLabel: string | null = null;
  if (filters.generation) {
    const { data: gen } = await supabase
      .from("generations")
      .select("generated_text")
      .eq("id", filters.generation)
      .maybeSingle();
    generationLabel = gen?.generated_text?.trim() || null;
  }

  return (
    <>
      {(filters.generation || filters.user) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {filters.generation && (
            <FilterChip
              label="Generation"
              value={
                <Link
                  href={buildHref("/admin/generations", { id: filters.generation })}
                  className="hover:underline"
                >
                  {generationLabel ?? shortId(filters.generation)}
                </Link>
              }
              clearHref={href({ ...filters, generation: null })}
            />
          )}
          {filters.user && (
            <FilterChip
              label="Voter"
              value={voters.get(filters.user)?.name ?? shortId(filters.user)}
              clearHref={href({ ...filters, user: null })}
            />
          )}
        </div>
      )}
      <nav aria-label="Filter votes" className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map(({ value, label }) => {
          const active = value === type;
          return (
            <Link
              key={value}
              href={href({ ...filters, type: value })}
              aria-current={active ? "page" : undefined}
              className={`rounded border px-3 py-1 text-sm ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              {label}
              {counts[value] !== null && (
                <span className={`ml-1.5 tabular-nums ${active ? "opacity-70" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {nf.format(counts[value]!)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <p className="mb-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {total === 0
          ? "No votes match."
          : `Showing ${from + 1}–${from + votes.length} of ${nf.format(total)} · newest first`}
      </p>

      {votes.length > 0 && (
        <>
          {/* Table on wider screens */}
          <div className="hidden overflow-x-auto rounded border border-zinc-200 md:block dark:border-zinc-800">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="w-36 px-3 py-2 font-medium">Vote ID</th>
                  <th className="px-3 py-2 font-medium">Generation</th>
                  <th className="w-48 px-3 py-2 font-medium">Voter</th>
                  <th className="w-28 px-3 py-2 font-medium">Vote</th>
                  <th className="w-44 px-3 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v) => (
                  <tr key={String(v.id)} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400" title={String(v.id)}>
                        {shortId(v.id)}
                      </span>{" "}
                      <CopyButton value={String(v.id)} label="Copy" />
                    </td>
                    <td className="px-3 py-2">
                      <GenerationRef vote={v} />
                    </td>
                    <td className="px-3 py-2">
                      <VoterRef userId={v.user_id} voter={voters.get(v.user_id)} />
                    </td>
                    <td className="px-3 py-2">
                      <VoteValue value={v.vote_value} />
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <time dateTime={v.created_at}>{timeFormat.format(new Date(v.created_at))}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards on small screens */}
          <ul className="flex flex-col gap-2 md:hidden">
            {votes.map((v) => (
              <li
                key={String(v.id)}
                className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <VoteValue value={v.vote_value} />
                  <time dateTime={v.created_at} className="text-xs text-zinc-500 dark:text-zinc-400">
                    {timeFormat.format(new Date(v.created_at))}
                  </time>
                </div>
                <GenerationRef vote={v} />
                <div className="flex items-center justify-between gap-2">
                  <VoterRef userId={v.user_id} voter={voters.get(v.user_id)} />
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400" title={String(v.id)}>
                    #{shortId(v.id)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination page={page} pageCount={pageCount} hrefFor={(n) => href(filters, n)} />
    </>
  );
}

export default function VotesPage({ searchParams }: PageProps<"/admin/votes">) {
  return (
    <>
      <PageHeader title="Votes" description="All upvotes and downvotes. Read-only." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <VotesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
