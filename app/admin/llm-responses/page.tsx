import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { one } from "@/lib/admin/rows";
import { RESPONSE_STATUSES, parseStatusParam } from "@/lib/admin/statuses";
import {
  buildHref,
  firstParam,
  parsePageParam,
  parseUuidParam,
  shortId,
  type SearchParams,
} from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import CopyButton from "@/components/admin/CopyButton";
import FilterChip from "@/components/admin/FilterChip";
import {
  FilterLinks,
  LoadError,
  Missing,
  RangeSummary,
  StatusBadge,
  Time,
  pageCountFor,
} from "@/components/admin/crud/ui";

const PAGE_SIZE = 25;
// Raw provider payloads can be large; show only the start.
const MAX_RAW_CHARS = 4_000;

type Status = (typeof RESPONSE_STATUSES)[number];
type Filters = { status: Status | null; request: string | null };

type ModelRef = { display_name: string; model_identifier: string };
type StepRef = { step_order: number; name: string };

type ResponseRow = {
  id: string;
  generation_request_id: string;
  response_text: string | null;
  raw_response: unknown;
  status: string;
  error_message: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
  llm_models: ModelRef | ModelRef[] | null;
  prompt_chain_steps: StepRef | StepRef[] | null;
};

const nf = new Intl.NumberFormat("en-US");

function href(filters: Filters, page = 1) {
  return buildHref("/admin/llm-responses", {
    status: filters.status,
    request: filters.request,
    page: page > 1 ? page : null,
  });
}

function rawPreview(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = JSON.stringify(raw, null, 2);
  return text.length > MAX_RAW_CHARS ? `${text.slice(0, MAX_RAW_CHARS)}\n…` : text;
}

async function ResponsesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  const params = await searchParams;
  const page = parsePageParam(params);
  const filters: Filters = {
    status: parseStatusParam(firstParam(params.status), RESPONSE_STATUSES),
    // Cross-navigation from generation requests (?request=).
    request: parseUuidParam(params.request),
  };
  const from = (page - 1) * PAGE_SIZE;

  // Read-only: llm_responses has a SELECT-only superadmin policy.
  let query = supabase
    .from("llm_responses")
    .select(
      "id, generation_request_id, response_text, raw_response, status, error_message, latency_ms, input_tokens, output_tokens, created_at, llm_models(display_name, model_identifier), prompt_chain_steps(step_order, name)",
      { count: "exact" },
    );
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.request) query = query.eq("generation_request_id", filters.request);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    logReadError("llm-responses", error);
    return <LoadError resource="LLM responses" />;
  }

  const rows = (data ?? []) as ResponseRow[];
  const total = count ?? 0;

  return (
    <>
      <FilterLinks
        active={filters.status ?? "all"}
        options={[
          { value: "all", label: "All", href: href({ ...filters, status: null }) },
          ...RESPONSE_STATUSES.map((s) => ({
            value: s,
            label: s[0].toUpperCase() + s.slice(1),
            href: href({ ...filters, status: s }),
          })),
        ]}
      />
      {filters.request && (
        <div className="mb-3">
          <FilterChip
            label="Request"
            value={<span className="font-mono text-xs">{shortId(filters.request)}</span>}
            clearHref={href({ ...filters, request: null })}
          />
        </div>
      )}

      <RangeSummary
        from={from}
        shown={rows.length}
        total={total}
        noun={["response", "responses"]}
        empty={
          filters.status || filters.request
            ? "No responses match."
            : "No LLM responses yet. The consumer app doesn't record them yet."
        }
        suffix="newest first"
      />

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const model = one(r.llm_models);
            const step = one(r.prompt_chain_steps);
            const raw = rawPreview(r.raw_response);
            return (
              <li key={r.id} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <StatusBadge status={r.status} />
                  <Time value={r.created_at} />
                  <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
                    {r.latency_ms !== null ? `${nf.format(r.latency_ms)} ms` : "latency —"}
                  </span>
                  <span title={model?.model_identifier}>
                    {model?.display_name ?? <Missing label="Unknown model" />}
                  </span>
                  {step && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Step {step.step_order}: {step.name}
                    </span>
                  )}
                </div>

                <p className="text-sm whitespace-pre-line">
                  {r.response_text?.trim() || <Missing label="(no response text)" />}
                </p>

                {r.error_message && (
                  <p className="rounded border border-red-200 px-2 py-1 text-xs whitespace-pre-line text-red-700 dark:border-red-900 dark:text-red-400">
                    {r.error_message}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                  <Link href={buildHref("/admin/llm-responses", { request: r.generation_request_id })} className="hover:underline">
                    Request <span className="font-mono">{shortId(r.generation_request_id)}</span>
                  </Link>
                  <span>
                    Tokens {r.input_tokens !== null ? nf.format(r.input_tokens) : "—"} in ·{" "}
                    {r.output_tokens !== null ? nf.format(r.output_tokens) : "—"} out
                  </span>
                  <span>
                    Response ID <span className="font-mono">{shortId(r.id)}</span> <CopyButton value={r.id} />
                  </span>
                </div>

                {raw && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">Raw response</summary>
                    <pre className="mt-2 max-h-60 overflow-auto rounded bg-zinc-50 p-2 font-mono whitespace-pre-wrap dark:bg-zinc-900">
                      {raw}
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pageCount={pageCountFor(total, PAGE_SIZE)} hrefFor={(n) => href(filters, n)} />
    </>
  );
}

export default function LlmResponsesPage({ searchParams }: PageProps<"/admin/llm-responses">) {
  return (
    <>
      <PageHeader title="LLM responses" description="Model outputs recorded for each generation request. Read-only." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ResponsesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
