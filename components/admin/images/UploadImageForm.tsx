"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { uploadImage } from "@/app/admin/images/actions";
import { primaryButtonClass } from "@/components/admin/crud/ActionForm";
import { inputClass } from "@/components/admin/crud/fields";
import { IDLE_STATE, type ActionState } from "@/lib/admin/forms";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  isAllowedImageType,
} from "@/lib/admin/meme-images";

// The file lives in state (not the input) so it survives a failed submit,
// as in CreateGenerationForm. The server re-validates the bytes.
export default function UploadImageForm() {
  const descriptionRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await uploadImage(prev, formData);
      if (result.status === "success") {
        setFile(null);
        setPreviewUrl(null);
        if (descriptionRef.current) descriptionRef.current.value = "";
      }
      return result;
    },
    IDLE_STATE,
  );

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
    formData.set("description", descriptionRef.current?.value ?? "");
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Image</span>
        <input
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          disabled={pending}
          onChange={(e) => {
            selectFile(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-sm text-zinc-900 file:mr-3 file:rounded file:border file:border-zinc-300 file:bg-transparent file:px-3 file:py-1.5 file:text-sm hover:file:bg-zinc-100 dark:text-zinc-100 dark:file:border-zinc-700 dark:hover:file:bg-zinc-900"
        />
        <span>JPEG, PNG, or WebP up to {MAX_IMAGE_LABEL}. Uploaded to your folder in the meme-images bucket.</span>
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
          className={`max-h-60 w-fit rounded border border-zinc-200 object-contain dark:border-zinc-800 ${pending ? "opacity-60" : ""}`}
        />
      )}

      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        Alt text (optional)
        <input
          ref={descriptionRef}
          type="text"
          name="description"
          maxLength={500}
          disabled={pending}
          placeholder="Describe the image for screen readers"
          className={inputClass}
        />
      </label>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending || !file} className={primaryButtonClass}>
          {pending ? "Uploading…" : "Upload image"}
        </button>
        {state.status === "success" && !file && (
          <span role="status" className="text-xs text-green-700 dark:text-green-400">
            ✓ {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
