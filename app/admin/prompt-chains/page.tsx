import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { one } from "@/lib/admin/rows";
import PageHeader from "@/components/admin/PageHeader";
import CopyButton from "@/components/admin/CopyButton";
import { ActiveBadge, LoadError, Missing, Note, Summary, Time } from "@/components/admin/crud/ui";

type ModelRef = { display_name: string; model_identifier: string };

type StepRow = {
  id: string;
  step_order: number;
  name: string;
  prompt_text: string;
  llm_models: ModelRef | ModelRef[] | null;
};

type MixRef = { weight: number; is_active: boolean };

type ChainRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  updated_at: string;
  prompt_chain_steps: StepRow[] | null;
  prompt_chain_mix: MixRef | MixRef[] | null;
};

function Step({ step }: { step: StepRow }) {
  const model = one(step.llm_models);
  return (
    <li className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          <span className="mr-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            Step {step.step_order}
          </span>
          {step.name}
        </p>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {model ? (
            <>
              {model.display_name} · <span className="font-mono">{model.model_identifier}</span>
            </>
          ) : (
            "Request's model"
          )}
        </span>
      </div>
      <pre className="mt-2 max-h-60 overflow-y-auto rounded bg-zinc-50 p-2 font-mono text-xs whitespace-pre-wrap dark:bg-zinc-900">
        {step.prompt_text}
      </pre>
      <div className="mt-1 flex justify-end">
        <CopyButton value={step.prompt_text} label="Copy prompt" />
      </div>
    </li>
  );
}

async function ChainsContent() {
  const { supabase } = await requireSuperadmin();

  // Read-only: chains and steps have SELECT-only policies for superadmins.
  const { data, error } = await supabase
    .from("prompt_chains")
    .select(
      "id, name, slug, description, updated_at, prompt_chain_steps(id, step_order, name, prompt_text, llm_models(display_name, model_identifier)), prompt_chain_mix(weight, is_active)",
    )
    .order("name")
    .order("step_order", { referencedTable: "prompt_chain_steps" });

  if (error) {
    logReadError("prompt-chains", error);
    return <LoadError resource="prompt chains" />;
  }

  const chains = (data ?? []) as ChainRow[];

  return (
    <>
      <Note>
        Prompt chains and their steps are read-only here. Weights and on/off status are managed
        on the{" "}
        <Link href="/admin/prompt-chain-mix" className="underline">
          prompt chain mix
        </Link>{" "}
        page.
      </Note>

      <Summary>
        {chains.length === 0
          ? "No prompt chains yet."
          : `${chains.length} ${chains.length === 1 ? "chain" : "chains"}`}
      </Summary>

      <ul className="flex flex-col gap-4">
        {chains.map((c) => {
          const steps = c.prompt_chain_steps ?? [];
          const mix = one(c.prompt_chain_mix);
          return (
            <li key={c.id} id={c.slug} className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{c.name}</h2>
                {mix ? (
                  <>
                    <ActiveBadge active={mix.is_active} />
                    <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                      Weight {mix.weight}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Not in the mix</span>
                )}
              </div>
              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{c.slug}</p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {c.description || <Missing label="No description" />}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Updated <Time value={c.updated_at} />
              </p>

              <h3 className="mt-3 mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {steps.length} {steps.length === 1 ? "step" : "steps"}
              </h3>
              {steps.length > 0 ? (
                <ol className="flex flex-col gap-2">
                  {steps.map((s) => (
                    <Step key={s.id} step={s} />
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-zinc-500">This chain has no steps.</p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function PromptChainsPage() {
  return (
    <>
      <PageHeader title="Prompt chains" description="Caption prompt chains and their ordered steps. Read-only." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ChainsContent />
      </Suspense>
    </>
  );
}
