"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createGeneration } from "@/app/admin/generations/actions";
import type { CreateGenerationState } from "@/lib/admin/generation-limits";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  isAllowedImageType,
} from "@/lib/admin/meme-images";

const initialState: CreateGenerationState = { status: "idle" };

// The file lives in state (not the input) so it survives a failed submit;
// React resets form fields after every action.
export default function CreateGenerationForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(createGeneration, initialState);

  // Release the current preview's object URL when it changes or on unmount.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Quick client-side checks for feedback; the server re-validates the bytes.
  function selectFile(next: File | undefined) {
    if (!next) return;
    if (!isAllowedImageType(next.type)) {
      setFileError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setFileError(`Images must be ${MAX_IMAGE_LABEL} or smaller.`);
      return;
    }
    setFileError(null);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !file) return;
    const formData = new FormData();
    formData.set("image", file);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Image</span>
        <input
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          disabled={pending}
          onChange={(e) => {
            selectFile(e.target.files?.[0]);
            // Allow re-selecting the same file.
            e.target.value = "";
          }}
          className="text-sm text-zinc-900 file:mr-3 file:rounded file:border file:border-zinc-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm hover:file:bg-zinc-100 dark:text-zinc-100 dark:file:border-zinc-700 dark:hover:file:bg-zinc-900"
        />
        <span>JPEG, PNG, or WebP up to {MAX_IMAGE_LABEL}.</span>
      </label>

      {fileError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {fileError}
        </p>
      )}

      {previewUrl && (
        // Local object URL preview; plain <img> is required for blob: URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Selected image preview"
          className={`max-h-80 w-fit rounded border border-zinc-200 object-contain dark:border-zinc-800 ${pending ? "opacity-60" : ""}`}
        />
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        The image is uploaded to your own folder in Storage and captioned by
        Gemini with the same prompt as the consumer app. The generation is
        saved under your account.
      </p>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !file}
          className="rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Generating…" : "Generate"}
        </button>
        <Link
          href="/admin/generations"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
