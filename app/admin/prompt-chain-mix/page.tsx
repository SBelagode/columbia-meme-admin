import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { one } from "@/lib/admin/rows";
import PageHeader from "@/components/admin/PageHeader";
import RecordEditor from "@/components/admin/crud/RecordEditor";
import { CheckboxField, NumberField } from "@/components/admin/crud/fields";
import { ActiveBadge, LoadError, Note, Summary, Time } from "@/components/admin/crud/ui";
import { updateMix } from "./actions";

type ChainRef = { name: string; slug: string };

type MixRow = {
  id: string;
  weight: number;
  is_active: boolean;
  updated_at: string;
  prompt_chains: ChainRef | ChainRef[] | null;
};

async function MixContent() {
  const { supabase } = await requireSuperadmin();

  const { data, error } = await supabase
    .from("prompt_chain_mix")
    .select("id, weight, is_active, updated_at, prompt_chains(name, slug)")
    .order("weight", { ascending: false })
    .order("id");

  if (error) {
    logReadError("prompt-chain-mix", error);
    return <LoadError resource="the prompt chain mix" />;
  }

  const rows = (data ?? []) as MixRow[];
  // Share of traffic among active chains with a positive weight.
  const activeWeight = rows.reduce((sum, r) => sum + (r.is_active ? r.weight : 0), 0);

  return (
    <>
      <Note>
        Each generation request picks one active chain, weighted by these values. You can change
        weights and on/off status; entries are added and removed together with their chain.
      </Note>

      <Summary>
        {rows.length === 0
          ? "No chains are in the mix."
          : activeWeight === 0
            ? "No active chain has a positive weight, so nothing would be selected."
            : `${rows.length} ${rows.length === 1 ? "entry" : "entries"} · total active weight ${activeWeight}`}
      </Summary>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const chain = one(r.prompt_chains);
            const share =
              r.is_active && activeWeight > 0 ? Math.round((r.weight / activeWeight) * 100) : 0;
            return (
              <li key={r.id} className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <RecordEditor
                  action={updateMix}
                  id={r.id}
                  view={
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {chain ? (
                          <Link
                            href={`/admin/prompt-chains#${chain.slug}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {chain.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-zinc-500">(chain unavailable)</span>
                        )}
                        <ActiveBadge active={r.is_active} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                        <span>Weight {r.weight}</span>
                        <span className="flex items-center gap-1.5">
                          <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-[var(--viz-track)]">
                            <span
                              className="block h-full rounded-full bg-[var(--viz-series-1)]"
                              style={{ width: `${share}%` }}
                            />
                          </span>
                          {share}% of requests
                        </span>
                        <span>
                          Updated <Time value={r.updated_at} />
                        </span>
                      </div>
                    </div>
                  }
                >
                  <NumberField label="Weight" name="weight" defaultValue={r.weight} min={0} max={1000} hint="0–1000. Relative to other active chains." />
                  <CheckboxField label="Active" name="is_active" defaultChecked={r.is_active} />
                </RecordEditor>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function PromptChainMixPage() {
  return (
    <>
      <PageHeader title="Prompt chain mix" description="How generation requests are split across prompt chains." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <MixContent />
      </Suspense>
    </>
  );
}
