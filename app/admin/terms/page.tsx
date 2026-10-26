import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { buildHref, parsePageParam, type SearchParams } from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import ActionForm from "@/components/admin/crud/ActionForm";
import RecordEditor from "@/components/admin/crud/RecordEditor";
import ConfirmDeleteButton from "@/components/admin/crud/ConfirmDeleteButton";
import { CheckboxField, TextAreaField, TextField } from "@/components/admin/crud/fields";
import {
  ActiveBadge,
  CreatePanel,
  LoadError,
  Missing,
  RangeSummary,
  Time,
  pageCountFor,
} from "@/components/admin/crud/ui";
import { createTerm, deleteTerm, updateTerm } from "./actions";

const PAGE_SIZE = 50;

type TermRow = {
  id: string;
  term: string;
  definition: string | null;
  is_active: boolean;
  updated_at: string;
};

function TermFields({ term }: { term?: TermRow }) {
  return (
    <>
      <TextField label="Term" name="term" defaultValue={term?.term} required maxLength={200} autoFocus={!!term} />
      <TextAreaField label="Definition (optional)" name="definition" defaultValue={term?.definition} maxLength={2000} />
      <CheckboxField label="Active" name="is_active" defaultChecked={term?.is_active ?? true} />
    </>
  );
}

async function TermsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  const page = parsePageParam(await searchParams);
  const from = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("terms")
    .select("id, term, definition, is_active, updated_at", { count: "exact" })
    .order("term")
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    logReadError("terms", error);
    return <LoadError resource="terms" />;
  }

  const terms = (data ?? []) as TermRow[];
  const total = count ?? 0;

  return (
    <>
      <CreatePanel label="New term">
        <ActionForm action={createTerm} submitLabel="Create term" pendingLabel="Creating…" resetOnSuccess>
          <TermFields />
        </ActionForm>
      </CreatePanel>

      <RangeSummary from={from} shown={terms.length} total={total} noun={["term", "terms"]} empty="No terms yet." suffix="A–Z" />

      {terms.length > 0 && (
        <ul className="flex flex-col gap-2">
          {terms.map((t) => (
            <li key={t.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <RecordEditor
                action={updateTerm}
                id={t.id}
                view={
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t.term}</span>
                      <ActiveBadge active={t.is_active} />
                    </div>
                    <p className="text-sm whitespace-pre-line text-zinc-700 dark:text-zinc-300">
                      {t.definition || <Missing label="No definition" />}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Updated <Time value={t.updated_at} />
                    </p>
                  </div>
                }
                actions={
                  <ConfirmDeleteButton action={deleteTerm} id={t.id} title="Delete this term?" confirmLabel="Delete term">
                    <span className="font-medium">{t.term}</span>
                  </ConfirmDeleteButton>
                }
              >
                <TermFields term={t} />
              </RecordEditor>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCountFor(total, PAGE_SIZE)}
        hrefFor={(n) => buildHref("/admin/terms", { page: n > 1 ? n : null })}
      />
    </>
  );
}

export default function TermsPage({ searchParams }: PageProps<"/admin/terms">) {
  return (
    <>
      <PageHeader title="Terms" description="Campus vocabulary available to caption prompts." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <TermsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
