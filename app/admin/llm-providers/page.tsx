import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { embeddedCount } from "@/lib/admin/rows";
import { buildHref } from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import ActionForm from "@/components/admin/crud/ActionForm";
import RecordEditor from "@/components/admin/crud/RecordEditor";
import ConfirmDeleteButton from "@/components/admin/crud/ConfirmDeleteButton";
import { CheckboxField, TextField } from "@/components/admin/crud/fields";
import { ActiveBadge, CreatePanel, LoadError, Summary, Time } from "@/components/admin/crud/ui";
import { createProvider, deleteProvider, updateProvider } from "./actions";

type ProviderRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  llm_models: { count: number }[] | null;
};

function ProviderFields({ provider }: { provider?: ProviderRow }) {
  return (
    <>
      <TextField label="Name" name="name" defaultValue={provider?.name} required maxLength={100} placeholder="Google Gemini" autoFocus={!!provider} />
      <TextField
        label="Slug"
        name="slug"
        defaultValue={provider?.slug}
        required
        maxLength={100}
        placeholder="google-gemini"
        mono
        hint="Lowercase letters, numbers and hyphens."
      />
      <CheckboxField label="Active" name="is_active" defaultChecked={provider?.is_active ?? true} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        API keys are never stored here; they stay in server environment variables.
      </p>
    </>
  );
}

async function ProvidersContent() {
  const { supabase } = await requireSuperadmin();

  // Small configuration table: no pagination.
  const { data, error } = await supabase
    .from("llm_providers")
    .select("id, name, slug, is_active, created_at, llm_models(count)")
    .order("name")
    .order("id");

  if (error) {
    logReadError("llm-providers", error);
    return <LoadError resource="LLM providers" />;
  }

  const providers = (data ?? []) as ProviderRow[];

  return (
    <>
      <CreatePanel label="New provider">
        <ActionForm action={createProvider} submitLabel="Create provider" pendingLabel="Creating…" resetOnSuccess>
          <ProviderFields />
        </ActionForm>
      </CreatePanel>

      <Summary>
        {providers.length === 0
          ? "No providers yet."
          : `${providers.length} ${providers.length === 1 ? "provider" : "providers"}`}
      </Summary>

      {providers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {providers.map((p) => {
            const models = embeddedCount(p.llm_models);
            return (
              <li key={p.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <RecordEditor
                  action={updateProvider}
                  id={p.id}
                  view={
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{p.slug}</span>
                        <ActiveBadge active={p.is_active} />
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        <Link
                          href={buildHref("/admin/llm-models", { provider: p.id })}
                          className="underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                        >
                          {models} {models === 1 ? "model" : "models"} →
                        </Link>{" "}
                        · Created <Time value={p.created_at} />
                      </p>
                    </div>
                  }
                  actions={
                    <ConfirmDeleteButton
                      action={deleteProvider}
                      id={p.id}
                      title="Delete this provider?"
                      confirmLabel="Delete provider"
                      warning={
                        models > 0
                          ? `It still has ${models} ${models === 1 ? "model" : "models"}, so the delete will be refused until they are removed.`
                          : undefined
                      }
                    >
                      <span className="font-medium">{p.name}</span>{" "}
                      <span className="font-mono text-xs text-zinc-500">{p.slug}</span>
                    </ConfirmDeleteButton>
                  }
                >
                  <ProviderFields provider={p} />
                </RecordEditor>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function LlmProvidersPage() {
  return (
    <>
      <PageHeader title="LLM providers" description="Companies or services that host the caption models." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ProvidersContent />
      </Suspense>
    </>
  );
}
