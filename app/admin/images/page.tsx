import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { logReadError } from "@/lib/admin/crud";
import { embeddedCount, one, personName } from "@/lib/admin/rows";
import { buildHref, firstParam, parsePageParam, shortId, type SearchParams } from "@/lib/admin/params";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";
import CopyButton from "@/components/admin/CopyButton";
import RecordEditor from "@/components/admin/crud/RecordEditor";
import ConfirmDeleteButton from "@/components/admin/crud/ConfirmDeleteButton";
import { TextField } from "@/components/admin/crud/fields";
import { CreatePanel, LoadError, Missing, RangeSummary, Thumb, Time, pageCountFor } from "@/components/admin/crud/ui";
import UploadImageForm from "@/components/admin/images/UploadImageForm";
import { deleteImage, updateImage } from "./actions";

const PAGE_SIZE = 24;

type Person = { first_name: string | null; last_name: string | null };

type ImageRow = {
  id: string;
  user_id: string | null;
  storage_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number | null;
  description: string | null;
  created_at: string;
  profiles: Person | Person[] | null;
  generations: { count: number }[] | null;
  generation_examples: { count: number }[] | null;
};

function formatBytes(bytes: number | null) {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DeletedBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p
      role="status"
      className="mb-4 flex items-center justify-between gap-3 rounded border border-green-300 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:text-green-400"
    >
      ✓ Image deleted, including its file in Storage.
      <Link href="/admin/images" className="shrink-0 text-xs underline">
        Dismiss
      </Link>
    </p>
  );
}

async function ImagesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireSuperadmin();
  const params = await searchParams;
  const page = parsePageParam(params);
  const from = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("images")
    .select(
      "id, user_id, storage_path, public_url, mime_type, size_bytes, description, created_at, profiles(first_name, last_name), generations(count), generation_examples(count)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    logReadError("images", error);
    return <LoadError resource="images" />;
  }

  const images = (data ?? []) as ImageRow[];
  const total = count ?? 0;

  return (
    <>
      <DeletedBanner show={firstParam(params.deleted) === "1"} />

      <CreatePanel label="Upload image">
        <UploadImageForm />
      </CreatePanel>

      <RangeSummary from={from} shown={images.length} total={total} noun={["image", "images"]} empty="No images yet." suffix="newest first" />

      {images.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((img) => {
            const uploader = personName(one(img.profiles));
            const generations = embeddedCount(img.generations);
            const examples = embeddedCount(img.generation_examples);
            const size = formatBytes(img.size_bytes);
            return (
              <li key={img.id} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <a href={img.public_url} target="_blank" rel="noreferrer" title="Open full size">
                  <Thumb src={img.public_url} alt={img.description ?? ""} size="h-48 w-full" />
                </a>
                <RecordEditor
                  action={updateImage}
                  id={img.id}
                  editLabel="Edit alt text"
                  view={
                    <div className="flex flex-col gap-1">
                      <p className="text-sm">{img.description || <Missing label="No alt text" />}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {uploader ?? (img.user_id ? <span className="font-mono">{shortId(img.user_id)}</span> : "Unknown uploader")} ·{" "}
                        <Time value={img.created_at} />
                      </p>
                      <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                        {img.mime_type}
                        {size && ` · ${size}`}
                        {generations > 0 && ` · ${generations} ${generations === 1 ? "generation" : "generations"}`}
                        {examples > 0 && ` · ${examples} ${examples === 1 ? "example" : "examples"}`}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="min-w-0 truncate font-mono" title={img.storage_path}>
                          {img.storage_path}
                        </span>
                        <CopyButton value={img.public_url} label="Copy URL" />
                      </p>
                    </div>
                  }
                  actions={
                    <ConfirmDeleteButton
                      action={deleteImage}
                      id={img.id}
                      title="Delete this image?"
                      confirmLabel="Delete image"
                      warning={
                        <>
                          This removes the file from the meme-images bucket, then deletes the image record. Its public URL will stop working.
                          {generations > 0 &&
                            ` It is used by ${generations} ${generations === 1 ? "generation" : "generations"}, so the delete will be refused.`}
                          {examples > 0 &&
                            ` ${examples} generation ${examples === 1 ? "example" : "examples"} will keep their caption but lose this image.`}
                        </>
                      }
                    >
                      <div className="flex gap-3">
                        <Thumb src={img.public_url} size="h-16 w-16" />
                        <div className="min-w-0">
                          <p className="line-clamp-2">{img.description || <Missing label="No alt text" />}</p>
                          <p className="truncate font-mono text-xs text-zinc-500">{img.storage_path}</p>
                        </div>
                      </div>
                    </ConfirmDeleteButton>
                  }
                >
                  <TextField
                    label="Alt text"
                    name="description"
                    defaultValue={img.description}
                    maxLength={500}
                    autoFocus
                    hint="The file itself can't be replaced; upload a new image instead."
                  />
                </RecordEditor>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        pageCount={pageCountFor(total, PAGE_SIZE)}
        hrefFor={(n) => buildHref("/admin/images", { page: n > 1 ? n : null })}
      />
    </>
  );
}

export default function ImagesPage({ searchParams }: PageProps<"/admin/images">) {
  return (
    <>
      <PageHeader title="Images" description="Images in the meme-images bucket, with their metadata." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ImagesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
