import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import FilterChip from "@/components/admin/FilterChip";
import {
  buildHref,
  parsePageParam,
  parseBigintIdParam,
  parseUserIdParam,
  shortId,
  type SearchParams,
} from "@/lib/admin/params";
import GenerationCard, {
  type GenerationItem,
} from "@/components/admin/generations/GenerationCard";
import { one } from "@/lib/admin/rows";

const PAGE_SIZE = 25;

type GenerationRow = {
  id: number;
  user_id: string;
  generated_text: string | null;
  user_prompt: string | null;
  generation_prompt: string | null;
  source_image_url: string | null;
  created_at: string;
  generation_request_id: string | null;
  llm_models: { display_name: string } | { display_name: string }[] | null;
  votes: { vote_value: number }[] | null;
};

type Filters = { user: string | null; id: string | null };

function listHref(filters: Filters, page = 1) {
  return buildHref("/admin/generations", {
    user: filters.user,
    id: filters.id,
    page: page > 1 ? page : null,
  });
}

async function GenerationsContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase } = await requireSuperadmin();
  const params = await searchParams;
  const page = parsePageParam(params);
  const justCreated = params.created === "1";
  const justDeleted = params.deleted === "1";
  // Cross-navigation filters from profiles (?user=) and votes (?id=).
  const filters: Filters = {
    user: parseUserIdParam(params.user),
    id: parseBigintIdParam(params.id),
  };
  const from = (page - 1) * PAGE_SIZE;

  // Read-only. Votes are embedded per generation; superadmin RLS policies
  // decide what both tables return.
  let query = supabase
    .from("generations")
    .select(
      "id, user_id, generated_text, user_prompt, generation_prompt, source_image_url, created_at, generation_request_id, llm_models(display_name), votes(vote_value)",
      { count: "exact" },
    );
  if (filters.user) query = query.eq("user_id", filters.user);
  if (filters.id) query = query.eq("id", filters.id);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error("[admin/generations]", error.code, error.message);
    return (
      <p className="rounded border border-red-300 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
        Could not load generations. Please try again.
      </p>
    );
  }

  const rows = (data ?? []) as GenerationRow[];

  // Creator names in one query; fall back to the user ID if unavailable.
  // Include the filtered user so the chip can show a name even with no rows.
  const userIds = [
    ...new Set([...rows.map((r) => r.user_id), ...(filters.user ? [filters.user] : [])]),
  ];
  const creators = new Map<string, { name: string | null; avatar: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", userIds);
    if (profileError) {
      console.error("[admin/generations] profiles", profileError.code, profileError.message);
    }
    for (const p of profiles ?? []) {
      creators.set(p.id, {
        name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null,
        avatar: p.avatar_url,
      });
    }
  }

  const items: GenerationItem[] = rows.map((r) => {
    const votes = r.votes ?? [];
    const creator = creators.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      creatorName: creator?.name ?? null,
      creatorAvatar: creator?.avatar ?? null,
      generatedText: r.generated_text,
      userPrompt: r.user_prompt,
      generationPrompt: r.generation_prompt,
      imageUrl: r.source_image_url || null,
      createdAt: r.created_at,
      modelName: one(r.llm_models)?.display_name ?? null,
      requestId: r.generation_request_id,
      upvotes: votes.filter((v) => v.vote_value > 0).length,
      downvotes: votes.filter((v) => v.vote_value < 0).length,
    };
  });

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {(justCreated || justDeleted) && (
        <p
          role="status"
          className="mb-4 flex items-center justify-between rounded border border-green-300 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:text-green-400"
        >
          {justDeleted ? "✓ Generation deleted." : "✓ Generation created."}
          <Link href={listHref(filters, page)} className="text-xs underline">
            Dismiss
          </Link>
        </p>
      )}
      {(filters.user || filters.id) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {filters.user && (
            <FilterChip
              label="Creator"
              value={creators.get(filters.user)?.name ?? shortId(filters.user)}
              clearHref={listHref({ ...filters, user: null })}
            />
          )}
          {filters.id && (
            <FilterChip
              label="Generation"
              value={<span className="font-mono text-xs">{shortId(filters.id)}</span>}
              clearHref={listHref({ ...filters, id: null })}
            />
          )}
        </div>
      )}
      <p className="mb-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {total === 0 ? (
          filters.user || filters.id ? (
            "No generations match."
          ) : (
            "No generations yet."
          )
        ) : items.length === 0 ? (
          // e.g. the last item on the last page was just deleted
          <>
            No generations on this page.{" "}
            <Link href={listHref(filters, pageCount)} className="underline">
              Go to page {pageCount}
            </Link>
          </>
        ) : (
          `Showing ${from + 1}–${from + items.length} of ${total} · newest first`
        )}
      </p>
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((g) => (
            <GenerationCard key={g.id} g={g} />
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(n) => listHref(filters, n)}
      />
    </>
  );
}

export default function GenerationsPage({
  searchParams,
}: PageProps<"/admin/generations">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Generated media"
          description="All AI-generated memes (the generations table): source image, generated caption and vote totals. Superadmins can edit text and prompts."
        />
        <Link
          href="/admin/generations/new"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          New generation
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <GenerationsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
