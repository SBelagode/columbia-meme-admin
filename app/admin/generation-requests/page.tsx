import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { embeddedCount, one, personName } from "@/lib/admin/rows";
import { REQUEST_STATUSES, parseStatusParam } from "@/lib/admin/statuses";
import {
  buildHref,
  firstParam,
  parsePageParam,
  parseUserIdParam,
  shortId,
  type SearchParams,
} from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import Avatar from "@/components/admin/Avatar";
import CopyButton from "@/components/admin/CopyButton";
import FilterChip from "@/components/admin/FilterChip";
import {
  FilterLinks,
  LoadError,
  Missing,
  RangeSummary,
  StatusBadge,
  Thumb,
  Time,
  pageCountFor,
} from "@/components/admin/crud/ui";

const PAGE_SIZE = 25;

type Status = (typeof REQUEST_STATUSES)[number];
type Filters = { status: Status | null; user: string | null };

type Person = { first_name: string | null; last_name: string | null; avatar_url: string | null };
type ImageRef = { public_url: string; description: string | null };
type ModelRef = { display_name: string; model_identifier: string };
type ChainRef = { name: string; slug: string };

type RequestRow = {
  id: string;
  user_id: string | null;
  user_prompt: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  profiles: Person | Person[] | null;
  images: ImageRef | ImageRef[] | null;
  llm_models: ModelRef | ModelRef[] | null;
  prompt_chains: ChainRef | ChainRef[] | null;
  llm_responses: { count: number }[] | null;
  generations: { id: number }[] | null;
};

function href(filters: Filters, page = 1) {
  return buildHref("/admin/generation-requests", {
    status: filters.status,
    user: filters.user,
    page: page > 1 ? page : null,
  });
}

function duration(start: string, end: string | null) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

async function RequestsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  const params = await searchParams;
  const page = parsePageParam(params);
  const filters: Filters = {
    status: parseStatusParam(firstParam(params.status), REQUEST_STATUSES),
    user: parseUserIdParam(params.user),
  };
  const from = (page - 1) * PAGE_SIZE;

  // Read-only: generation_requests has a SELECT-only superadmin policy.
  let query = supabase
    .from("generation_requests")
    .select(
      "id, user_id, user_prompt, status, error_message, created_at, completed_at, profiles(first_name, last_name, avatar_url), images(public_url, description), llm_models(display_name, model_identifier), prompt_chains(name, slug), llm_responses(count), generations(id)",
      { count: "exact" },
    );
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.user) query = query.eq("user_id", filters.user);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    logReadError("generation-requests", error);
    return <LoadError resource="generation requests" />;
  }

  const rows = (data ?? []) as RequestRow[];
  const total = count ?? 0;

  return (
    <>
      <FilterLinks
        active={filters.status ?? "all"}
        options={[
          { value: "all", label: "All", href: href({ ...filters, status: null }) },
          ...REQUEST_STATUSES.map((s) => ({
            value: s,
            label: s[0].toUpperCase() + s.slice(1),
            href: href({ ...filters, status: s }),
          })),
        ]}
      />
      {filters.user && (
        <div className="mb-3">
          <FilterChip
            label="User"
            value={<span className="font-mono text-xs">{shortId(filters.user)}</span>}
            clearHref={href({ ...filters, user: null })}
          />
        </div>
      )}

      <RangeSummary
        from={from}
        shown={rows.length}
        total={total}
        noun={["request", "requests"]}
        empty={
          filters.status || filters.user
            ? "No requests match."
            : "No generation requests yet. The consumer app doesn't record them yet."
        }
        suffix="newest first"
      />

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const person = one(r.profiles);
            const name = personName(person);
            const image = one(r.images);
            const model = one(r.llm_models);
            const chain = one(r.prompt_chains);
            const responses = embeddedCount(r.llm_responses);
            const generation = r.generations?.[0];
            const took = duration(r.created_at, r.completed_at);
            return (
              <li key={r.id} className="flex gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <Thumb src={image?.public_url} alt={image?.description ?? ""} size="h-20 w-20" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <StatusBadge status={r.status} />
                    <Time value={r.created_at} />
                    {took && <span className="text-zinc-500 tabular-nums dark:text-zinc-400">took {took}</span>}
                    {r.user_id ? (
                      <Link
                        href={href({ ...filters, user: r.user_id })}
                        title="All requests by this user"
                        className="flex items-center gap-1.5 hover:underline"
                      >
                        <Avatar src={person?.avatar_url ?? null} name={name ?? ""} size={20} />
                        {name ?? <span className="font-mono">{shortId(r.user_id)}</span>}
                      </Link>
                    ) : (
                      <Missing label="Unknown user" />
                    )}
                  </div>

                  {r.error_message && (
                    <p className="rounded border border-red-200 px-2 py-1 text-xs whitespace-pre-line text-red-700 dark:border-red-900 dark:text-red-400">
                      {r.error_message}
                    </p>
                  )}

                  <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    <Field label="Model">
                      {model ? (
                        <span title={model.model_identifier}>{model.display_name}</span>
                      ) : (
                        <Missing />
                      )}
                    </Field>
                    <Field label="Prompt chain">
                      {chain ? (
                        <Link href={`/admin/prompt-chains#${chain.slug}`} className="hover:underline">
                          {chain.name}
                        </Link>
                      ) : (
                        <Missing />
                      )}
                    </Field>
                    <Field label="Result">
                      <span className="flex gap-2">
                        {responses > 0 ? (
                          <Link href={buildHref("/admin/llm-responses", { request: r.id })} className="hover:underline">
                            {responses} {responses === 1 ? "response" : "responses"} →
                          </Link>
                        ) : (
                          <Missing label="No responses" />
                        )}
                        {generation && (
                          <Link href={buildHref("/admin/generations", { id: generation.id })} className="hover:underline">
                            Generation →
                          </Link>
                        )}
                      </span>
                    </Field>
                  </dl>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">Details</summary>
                    <dl className="mt-2 grid gap-2">
                      <div>
                        <dt className="text-zinc-500 dark:text-zinc-400">User prompt</dt>
                        <dd className="whitespace-pre-line">{r.user_prompt || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500 dark:text-zinc-400">Completed</dt>
                        <dd>
                          <Time value={r.completed_at} />
                        </dd>
                      </div>
                      <div>
                        <span className="text-zinc-500 dark:text-zinc-400">Request ID </span>
                        <span className="font-mono">{shortId(r.id)}</span> <CopyButton value={r.id} />
                      </div>
                    </dl>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pageCount={pageCountFor(total, PAGE_SIZE)} hrefFor={(n) => href(filters, n)} />
    </>
  );
}

export default function GenerationRequestsPage({
  searchParams,
}: PageProps<"/admin/generation-requests">) {
  return (
    <>
      <PageHeader title="Generation requests" description="Every caption generation attempt, including failures. Read-only." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <RequestsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
