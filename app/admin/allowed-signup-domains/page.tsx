import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { buildHref, parsePageParam, type SearchParams } from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import ActionForm from "@/components/admin/crud/ActionForm";
import RecordEditor from "@/components/admin/crud/RecordEditor";
import ConfirmDeleteButton from "@/components/admin/crud/ConfirmDeleteButton";
import { CheckboxField, TextField } from "@/components/admin/crud/fields";
import {
  ActiveBadge,
  CreatePanel,
  LoadError,
  RangeSummary,
  Note,
  Time,
  pageCountFor,
} from "@/components/admin/crud/ui";
import { createDomain, deleteDomain, updateDomain } from "./actions";

const PAGE_SIZE = 50;

type DomainRow = { id: string; domain: string; is_active: boolean; created_at: string };

function DomainFields({ row }: { row?: DomainRow }) {
  return (
    <>
      <TextField label="Domain" name="domain" defaultValue={row?.domain} required maxLength={253} placeholder="columbia.edu" mono autoFocus={!!row} />
      <CheckboxField label="Active" name="is_active" defaultChecked={row?.is_active ?? true} />
    </>
  );
}

async function DomainsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  const page = parsePageParam(await searchParams);
  const from = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("allowed_signup_domains")
    .select("id, domain, is_active, created_at", { count: "exact" })
    .order("domain")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    logReadError("allowed-signup-domains", error);
    return <LoadError resource="allowed signup domains" />;
  }

  const rows = (data ?? []) as DomainRow[];
  const total = count ?? 0;

  return (
    <>
      <Note>
        This list is stored for signup checks. Sign-in doesn&apos;t enforce it yet; that is a
        separate change to the consumer app&apos;s auth flow.
      </Note>

      <CreatePanel label="Add domain">
        <ActionForm action={createDomain} submitLabel="Add domain" pendingLabel="Adding…" resetOnSuccess>
          <DomainFields />
        </ActionForm>
      </CreatePanel>

      <RangeSummary from={from} shown={rows.length} total={total} noun={["domain", "domains"]} empty="No domains yet." />

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((d) => (
            <li key={d.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <RecordEditor
                action={updateDomain}
                id={d.id}
                view={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">@{d.domain}</span>
                    <ActiveBadge active={d.is_active} />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Added <Time value={d.created_at} />
                    </span>
                  </div>
                }
                actions={
                  <ConfirmDeleteButton action={deleteDomain} id={d.id} title="Remove this domain?" confirmLabel="Remove domain">
                    <span className="font-mono">@{d.domain}</span>
                  </ConfirmDeleteButton>
                }
              >
                <DomainFields row={d} />
              </RecordEditor>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCountFor(total, PAGE_SIZE)}
        hrefFor={(n) => buildHref("/admin/allowed-signup-domains", { page: n > 1 ? n : null })}
      />
    </>
  );
}

export default function AllowedSignupDomainsPage({
  searchParams,
}: PageProps<"/admin/allowed-signup-domains">) {
  return (
    <>
      <PageHeader title="Allowed signup domains" description="Email domains whose users may sign up." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <DomainsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
