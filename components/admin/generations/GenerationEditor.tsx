"use client";

import { useActionState, useState } from "react";
import { updateGeneration } from "@/app/admin/generations/actions";
import {
  MAX_GENERATED_TEXT,
  MAX_GENERATION_PROMPT,
  type UpdateGenerationState,
} from "@/lib/admin/generation-limits";

const initialState: UpdateGenerationState = { status: "idle" };

const inputClass =
  "w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100";
const buttonClass =
  "rounded border px-3 py-1 text-sm disabled:opacity-50";

// Shows the generated text, and swaps to an edit form on request. The server
// action re-checks superadmin access and RLS decides whether the write lands.
export default function GenerationEditor({
  id,
  generatedText,
  generationPrompt,
}: {
  id: number;
  generatedText: string | null;
  generationPrompt: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: UpdateGenerationState, formData: FormData) => {
      const result = await updateGeneration(prev, formData);
      if (result.status === "success") setEditing(false);
      return result;
    },
    initialState,
  );

  if (!editing) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm whitespace-pre-line">
          {generatedText?.trim() || (
            <span className="text-zinc-400 dark:text-zinc-500">(no text)</span>
          )}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Edit
          </button>
          {state.status === "success" && (
            <span role="status" className="text-xs text-green-700 dark:text-green-400">
              ✓ {state.message}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        Generated text
        <textarea
          name="generated_text"
          defaultValue={generatedText ?? ""}
          required
          maxLength={MAX_GENERATED_TEXT}
          rows={3}
          autoFocus
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        Generation prompt
        <textarea
          name="generation_prompt"
          defaultValue={generationPrompt ?? ""}
          required
          maxLength={MAX_GENERATION_PROMPT}
          rows={4}
          className={`${inputClass} font-mono text-xs`}
        />
      </label>

      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass} border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(false)}
          className={`${buttonClass} border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900`}
        >
          Cancel
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Creator, ID and created time can&apos;t be edited.
        </span>
      </div>
    </form>
  );
}
