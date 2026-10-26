import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { one } from "@/lib/admin/rows";
import { parseUuidParam, type SearchParams } from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import FilterChip from "@/components/admin/FilterChip";
import ActionForm from "@/components/admin/crud/ActionForm";
import RecordEditor from "@/components/admin/crud/RecordEditor";
import ConfirmDeleteButton from "@/components/admin/crud/ConfirmDeleteButton";
import { CheckboxField, SelectField, TextField } from "@/components/admin/crud/fields";
import { ActiveBadge, CreatePanel, LoadError, Summary } from "@/components/admin/crud/ui";
import { createModel, deleteModel, updateModel } from "./actions";

type Provider = { id: string; name: string };

type ModelRow = {
  id: string;
  provider_id: string;
  model_identifier: string;
  display_name: string;
  supports_images: boolean;
  is_active: boolean;
  llm_providers: { name: string } | { name: string }[] | null;
};

function ModelFields({ model, providers }: { model?: ModelRow; providers: Provider[] }) {
  return (
    <>
      <SelectField
        label="Provider"
        name="provider_id"
        required
        defaultValue={model?.provider_id}
        options={providers.map((p) => ({ value: p.id, label: p.name }))}
      />
      <TextField
        label="Model identifier"
        name="model_identifier"
        defaultValue={model?.model_identifier}
        required
        maxLength={200}
        placeholder="gemini-3.5-flash-lite"
        mono
        hint="The exact ID sent to the provider's API."
      />
      <TextField label="Display name" name="display_name" defaultValue={model?.display_name} required maxLength={200} placeholder="Gemini 3.5 Flash-Lite" />
      <CheckboxField label="Supports image input" name="supports_images" defaultChecked={model?.supports_images ?? false} />
      <CheckboxField label="Active" name="is_active" defaultChecked={model?.is_active ?? true} />
    </>
  );
}

async function ModelsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  // ?provider= comes from the providers page.
  const providerFilter = parseUuidParam((await searchParams).provider);

  let query = supabase
    .from("llm_models")
    .select("id, provider_id, model_identifier, display_name, supports_images, is_active, llm_providers(name)")
    .order("display_name")
    .order("id");
  if (providerFilter) query = query.eq("provider_id", providerFilter);

  const [models, providers] = await Promise.all([
    query,
    supabase.from("llm_providers").select("id, name").order("name"),
  ]);

  if (models.error || providers.error) {
    if (models.error) logReadError("llm-models", models.error);
    if (providers.error) logReadError("llm-models providers", providers.error);
    return <LoadError resource="LLM models" />;
  }

  const rows = (models.data ?? []) as ModelRow[];
  const providerList = (providers.data ?? []) as Provider[];
  const filterName = providerList.find((p) => p.id === providerFilter)?.name;

  return (
    <>
      <CreatePanel label="New model">
        {providerList.length === 0 ? (
          <p className="text-sm text-zinc-500">Create a provider first.</p>
        ) : (
          <ActionForm action={createModel} submitLabel="Create model" pendingLabel="Creating…" resetOnSuccess>
            <ModelFields providers={providerList} />
          </ActionForm>
        )}
      </CreatePanel>

      {providerFilter && (
        <div className="mb-3">
          <FilterChip label="Provider" value={filterName ?? "Unknown"} clearHref="/admin/llm-models" />
        </div>
      )}

      <Summary>
        {rows.length === 0 ? "No models match." : `${rows.length} ${rows.length === 1 ? "model" : "models"}`}
      </Summary>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((m) => {
            const providerName = one(m.llm_providers)?.name;
            return (
              <li key={m.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <RecordEditor
                  action={updateModel}
                  id={m.id}
                  view={
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{m.display_name}</span>
                        <ActiveBadge active={m.is_active} />
                        {m.supports_images && (
                          <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-700">
                            Images
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {providerName ?? "Unknown provider"} ·{" "}
                        <span className="font-mono">{m.model_identifier}</span>
                      </p>
                    </div>
                  }
                  actions={
                    <ConfirmDeleteButton
                      action={deleteModel}
                      id={m.id}
                      title="Delete this model?"
                      confirmLabel="Delete model"
                      warning="Requests, responses, prompt steps and generations that used it keep their rows but lose the link to this model."
                    >
                      <span className="font-medium">{m.display_name}</span>{" "}
                      <span className="font-mono text-xs text-zinc-500">{m.model_identifier}</span>
                    </ConfirmDeleteButton>
                  }
                >
                  <ModelFields model={m} providers={providerList} />
                </RecordEditor>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function LlmModelsPage({ searchParams }: PageProps<"/admin/llm-models">) {
  return (
    <>
      <PageHeader title="LLM models" description="Models available for caption generation, with their provider." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ModelsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
