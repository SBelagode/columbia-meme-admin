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
  Missing,
  RangeSummary,
  Note,
  Time,
  pageCountFor,
} from "@/components/admin/crud/ui";
import { createEmail, deleteEmail, updateEmail } from "./actions";

const PAGE_SIZE = 50;

type EmailRow = {
  id: string;
  email: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
};

function EmailFields({ row }: { row?: EmailRow }) {
  return (
    <>
      <TextField label="Email" name="email" type="email" defaultValue={row?.email} required maxLength={320} placeholder="name@example.com" autoFocus={!!row} />
      <TextField label="Note (optional)" name="note" defaultValue={row?.note} maxLength={500} placeholder="e.g. Visiting TA" />
      <CheckboxField label="Active" name="is_active" defaultChecked={row?.is_active ?? true} />
    </>
  );
}

async function EmailsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  const page = parsePageParam(await searchParams);
  const from = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("whitelisted_emails")
    .select("id, email, note, is_active, created_at", { count: "exact" })
    .order("email")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    logReadError("whitelisted-emails", error);
    return <LoadError resource="whitelisted emails" />;
  }

  const rows = (data ?? []) as EmailRow[];
  const total = count ?? 0;

  return (
    <>
      <Note>
        This list is stored for signup checks. Sign-in doesn&apos;t enforce it yet; that is a
        separate change to the consumer app&apos;s auth flow.
      </Note>

      <CreatePanel label="Add email">
        <ActionForm action={createEmail} submitLabel="Add email" pendingLabel="Adding…" resetOnSuccess>
          <EmailFields />
        </ActionForm>
      </CreatePanel>

      <RangeSummary from={from} shown={rows.length} total={total} noun={["email", "emails"]} empty="No whitelisted emails yet." />

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((e) => (
            <li key={e.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <RecordEditor
                action={updateEmail}
                id={e.id}
                view={
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm break-all">{e.email}</span>
                      <ActiveBadge active={e.is_active} />
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {e.note || <Missing label="No note" />} · Added <Time value={e.created_at} />
                    </p>
                  </div>
                }
                actions={
                  <ConfirmDeleteButton action={deleteEmail} id={e.id} title="Remove this email?" confirmLabel="Remove email">
                    <span className="break-all">{e.email}</span>
                  </ConfirmDeleteButton>
                }
              >
                <EmailFields row={e} />
              </RecordEditor>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCountFor(total, PAGE_SIZE)}
        hrefFor={(n) => buildHref("/admin/whitelisted-emails", { page: n > 1 ? n : null })}
      />
    </>
  );
}

export default function WhitelistedEmailsPage({
  searchParams,
}: PageProps<"/admin/whitelisted-emails">) {
  return (
    <>
      <PageHeader title="Whitelisted emails" description="Individual addresses allowed to sign up regardless of domain." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EmailsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
