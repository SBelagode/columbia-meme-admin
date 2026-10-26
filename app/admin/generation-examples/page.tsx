import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { one } from "@/lib/admin/rows";
import { buildHref, parsePageParam, shortId, type SearchParams } from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import ActionForm from "@/components/admin/crud/ActionForm";
import RecordEditor from "@/components/admin/crud/RecordEditor";
import ConfirmDeleteButton from "@/components/admin/crud/ConfirmDeleteButton";
import { CheckboxField, SelectField, TextAreaField } from "@/components/admin/crud/fields";
import {
  ActiveBadge,
  CreatePanel,
  LoadError,
  Missing,
  RangeSummary,
  Thumb,
  Time,
  pageCountFor,
} from "@/components/admin/crud/ui";
import { createExample, deleteExample, updateExample } from "./actions";

const PAGE_SIZE = 25;
// Option lists for the image / chain selects.
const MAX_OPTIONS = 200;

type Option = { value: string; label: string };
type ImageRef = { public_url: string; description: string | null };
type ChainRef = { name: string; slug: string };

type ExampleRow = {
  id: string;
  caption: string;
  notes: string | null;
  image_id: string | null;
  prompt_chain_id: string | null;
  is_active: boolean;
  updated_at: string;
  images: ImageRef | ImageRef[] | null;
  prompt_chains: ChainRef | ChainRef[] | null;
};

function ExampleFields({
  example,
  images,
  chains,
}: {
  example?: ExampleRow;
  images: Option[];
  chains: Option[];
}) {
  return (
    <>
      <TextAreaField label="Caption" name="caption" defaultValue={example?.caption} required maxLength={5000} />
      <SelectField label="Image (optional)" name="image_id" defaultValue={example?.image_id} options={images} emptyLabel="No image" />
      <SelectField label="Prompt chain (optional)" name="prompt_chain_id" defaultValue={example?.prompt_chain_id} options={chains} emptyLabel="Any chain" />
      <TextAreaField label="Notes (optional)" name="notes" defaultValue={example?.notes} maxLength={2000} rows={2} />
      <CheckboxField label="Active" name="is_active" defaultChecked={example?.is_active ?? true} />
      {images.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          To attach an image, first{" "}
          <Link href="/admin/images" className="underline">
            upload one
          </Link>
          .
        </p>
      )}
    </>
  );
}

async function ExamplesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  const page = parsePageParam(await searchParams);
  const from = (page - 1) * PAGE_SIZE;

  const [examples, images, chains] = await Promise.all([
    supabase
      .from("generation_examples")
      .select(
        "id, caption, notes, image_id, prompt_chain_id, is_active, updated_at, images(public_url, description), prompt_chains(name, slug)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE_SIZE - 1),
    supabase
      .from("images")
      .select("id, description, storage_path")
      .order("created_at", { ascending: false })
      .limit(MAX_OPTIONS),
    supabase.from("prompt_chains").select("id, name").order("name").limit(MAX_OPTIONS),
  ]);

  for (const [label, result] of [
    ["generation-examples", examples],
    ["generation-examples images", images],
    ["generation-examples chains", chains],
  ] as const) {
    if (result.error) logReadError(label, result.error);
  }
  if (examples.error || images.error || chains.error) {
    return <LoadError resource="generation examples" />;
  }

  const rows = (examples.data ?? []) as ExampleRow[];
  const total = examples.count ?? 0;
  const imageOptions: Option[] = (images.data ?? []).map((i) => ({
    value: i.id,
    label: i.description?.trim() || i.storage_path.split("/").pop() || shortId(i.id),
  }));
  const chainOptions: Option[] = (chains.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  // Keep a linked image selectable even if it's older than the option list.
  for (const r of rows) {
    const image = one(r.images);
    if (r.image_id && image && !imageOptions.some((o) => o.value === r.image_id)) {
      imageOptions.push({ value: r.image_id, label: image.description?.trim() || shortId(r.image_id) });
    }
  }

  return (
    <>
      <CreatePanel label="New example">
        <ActionForm action={createExample} submitLabel="Create example" pendingLabel="Creating…" resetOnSuccess>
          <ExampleFields images={imageOptions} chains={chainOptions} />
        </ActionForm>
      </CreatePanel>

      <RangeSummary from={from} shown={rows.length} total={total} noun={["example", "examples"]} empty="No generation examples yet." suffix="newest first" />

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((ex) => {
            const image = one(ex.images);
            const chain = one(ex.prompt_chains);
            return (
              <li key={ex.id} className="flex gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <Thumb src={image?.public_url} alt={image?.description ?? ""} size="h-24 w-24" />
                <div className="min-w-0 flex-1">
                  <RecordEditor
                    action={updateExample}
                    id={ex.id}
                    view={
                      <div className="flex flex-col gap-1">
                        <p className="text-sm whitespace-pre-line">{ex.caption}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <ActiveBadge active={ex.is_active} />
                          {chain ? (
                            <Link href={`/admin/prompt-chains#${chain.slug}`} className="hover:underline">
                              {chain.name}
                            </Link>
                          ) : (
                            <span>Any chain</span>
                          )}
                          <span>
                            Updated <Time value={ex.updated_at} />
                          </span>
                        </div>
                        {ex.notes && (
                          <p className="text-xs whitespace-pre-line text-zinc-500 dark:text-zinc-400">
                            {ex.notes}
                          </p>
                        )}
                      </div>
                    }
                    actions={
                      <ConfirmDeleteButton
                        action={deleteExample}
                        id={ex.id}
                        title="Delete this example?"
                        confirmLabel="Delete example"
                        warning="The linked image is not deleted."
                      >
                        <p className="line-clamp-3">{ex.caption || <Missing />}</p>
                      </ConfirmDeleteButton>
                    }
                  >
                    <ExampleFields example={ex} images={imageOptions} chains={chainOptions} />
                  </RecordEditor>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCountFor(total, PAGE_SIZE)}
        hrefFor={(n) => buildHref("/admin/generation-examples", { page: n > 1 ? n : null })}
      />
    </>
  );
}

export default function GenerationExamplesPage({
  searchParams,
}: PageProps<"/admin/generation-examples">) {
  return (
    <>
      <PageHeader title="Generation examples" description="Reference captions, optionally tied to an image and a prompt chain." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ExamplesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
