"use client";

import { useActionState, useRef } from "react";
import { deleteGeneration } from "@/app/admin/generations/actions";
import type { DeleteGenerationState } from "@/lib/admin/generation-limits";

const initialState: DeleteGenerationState = { status: "idle" };

// The first click only opens a confirmation dialog; the delete runs on the
// server after the admin confirms.
export default function DeleteGenerationButton({
  id,
  imageUrl,
  text,
  creator,
  createdLabel,
  voteCount,
}: {
  id: number;
  imageUrl: string | null;
  text: string | null;
  creator: string;
  createdLabel: string;
  voteCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnToRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(deleteGeneration, initialState);

  function open() {
    if (returnToRef.current) {
      returnToRef.current.value = window.location.pathname + window.location.search;
    }
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="text-xs text-red-700 underline-offset-2 hover:underline dark:text-red-400"
      >
        Delete
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-title-${id}`}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded border border-zinc-200 bg-white p-0 text-zinc-900 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        <form action={formAction} className="flex flex-col gap-4 p-4">
          <input type="hidden" name="id" value={id} />
          <input ref={returnToRef} type="hidden" name="return_to" defaultValue="" />

          <h2 id={`delete-title-${id}`} className="text-base font-semibold">
            Delete this generation?
          </h2>

          <div className="flex gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
            {imageUrl ? (
              // Supabase Storage public URL; plain <img> avoids remote image config.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded bg-zinc-100 object-cover dark:bg-zinc-800"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700">
                No image
              </div>
            )}
            <div className="min-w-0 text-sm">
              <p className="line-clamp-3">
                {text?.trim() || <span className="text-zinc-400">(no text)</span>}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {creator} · {createdLabel} · ID {id}
              </p>
            </div>
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This permanently removes the generation
            {voteCount > 0 &&
              ` and its ${voteCount} ${voteCount === 1 ? "vote" : "votes"}`}
            . The image file stays in Storage. This can&apos;t be undone.
          </p>

          {state.status === "error" && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {state.message}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded border border-red-700 bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete generation"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
