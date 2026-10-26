"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth";
import {
  GENERATION_PROMPT,
  IMAGE_EXTENSIONS,
  captionImage,
  describeError,
  sniffImageType,
} from "@/lib/admin/caption-generation";
import {
  IMAGE_USER_PROMPT,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  MEME_BUCKET,
} from "@/lib/admin/meme-images";
import {
  MAX_GENERATED_TEXT,
  MAX_GENERATION_PROMPT,
  type CreateGenerationState,
  type DeleteGenerationState,
  type UpdateGenerationState,
} from "@/lib/admin/generation-limits";

type SupabaseClient = Awaited<ReturnType<typeof requireSuperadmin>>["supabase"];

function field(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

// Only generated_text and generation_prompt are writable here. id, user_id
// and created_at are never read from the form, so they can't be changed.
export async function updateGeneration(
  _prev: UpdateGenerationState,
  formData: FormData,
): Promise<UpdateGenerationState> {
  // Re-verify on the server for every mutation; never trust the client.
  const { supabase } = await requireSuperadmin();

  const id = field(formData, "id")?.trim() ?? "";
  const generatedText = field(formData, "generated_text")?.trim() ?? "";
  const generationPrompt = field(formData, "generation_prompt");

  // generations.id is a bigint.
  if (!/^[1-9][0-9]{0,18}$/.test(id)) {
    return { status: "error", message: "Invalid generation." };
  }
  if (!generatedText) {
    return { status: "error", message: "Generated text can't be empty." };
  }
  if (generatedText.length > MAX_GENERATED_TEXT) {
    return {
      status: "error",
      message: `Generated text must be ${MAX_GENERATED_TEXT.toLocaleString()} characters or fewer.`,
    };
  }

  const update: { generated_text: string; generation_prompt?: string } = {
    generated_text: generatedText,
  };
  if (generationPrompt !== null) {
    const prompt = generationPrompt.trim();
    if (!prompt) {
      return { status: "error", message: "Generation prompt can't be empty." };
    }
    if (prompt.length > MAX_GENERATION_PROMPT) {
      return {
        status: "error",
        message: `Generation prompt must be ${MAX_GENERATION_PROMPT.toLocaleString()} characters or fewer.`,
      };
    }
    update.generation_prompt = prompt;
  }

  // RLS remains authoritative: if the policy rejects the update, no row is
  // returned and we report it without exposing database details.
  const { data, error } = await supabase
    .from("generations")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[admin/generations] update failed:", error.code, error.message);
    return { status: "error", message: "Couldn't save changes. Please try again." };
  }
  if (!data || data.length === 0) {
    return {
      status: "error",
      message: "This generation no longer exists or you don't have permission to edit it.",
    };
  }

  refresh();
  return { status: "success", message: "Changes saved." };
}

const UPLOAD_FAILED_MESSAGE = "The image couldn't be uploaded. Please try again.";
const GENERATION_FAILED_MESSAGE = "Generation failed. Please try again.";
const BLOCKED_MESSAGE = "Gemini couldn't caption that image. Try a different one.";
const SAVE_FAILED_MESSAGE = "The caption couldn't be saved. Please try again.";

// Best effort, as in the consumer app. The superadmin DELETE policy on
// meme-images lets this succeed; a failure only leaves a harmless orphan.
async function discardUpload(supabase: SupabaseClient, path: string) {
  const { error } = await supabase.storage.from(MEME_BUCKET).remove([path]);
  if (error) console.error("[admin/generations] cleanup of unused upload failed:", error.message);
}

// Same pipeline as the consumer app's generateCaption: validate the image,
// upload it to meme-images/<admin id>/<uuid>.<ext>, caption it with Gemini,
// then insert the generation as the signed-in superadmin. No row is created
// unless Gemini returns a caption.
export async function createGeneration(
  _prev: CreateGenerationState,
  formData: FormData,
): Promise<CreateGenerationState> {
  const { supabase, user } = await requireSuperadmin();

  try {
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) {
      return { status: "error", message: "Please choose an image first." };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { status: "error", message: `Images must be ${MAX_IMAGE_LABEL} or smaller.` };
    }
    const bytes = await file.arrayBuffer();
    const mimeType = sniffImageType(bytes);
    if (!mimeType) {
      return { status: "error", message: "Please upload a JPEG, PNG, or WebP image." };
    }

    // The admin's own folder satisfies the existing own-folder INSERT policy.
    const path = `${user.id}/${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`;
    const { error: uploadError } = await supabase.storage
      .from(MEME_BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) {
      console.error("[admin/generations] image upload failed:", uploadError.message);
      return { status: "error", message: UPLOAD_FAILED_MESSAGE };
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(MEME_BUCKET).getPublicUrl(path);

    const caption = await captionImage(bytes, mimeType);
    if (!caption.ok) {
      await discardUpload(supabase, path);
      return {
        status: "error",
        message: caption.reason === "blocked" ? BLOCKED_MESSAGE : GENERATION_FAILED_MESSAGE,
      };
    }

    const { error } = await supabase.from("generations").insert({
      user_id: user.id,
      user_prompt: IMAGE_USER_PROMPT,
      generation_prompt: GENERATION_PROMPT,
      generated_text: caption.caption,
      source_image_url: publicUrl,
    });
    if (error) {
      console.error("[admin/generations] insert failed:", error.code, error.message);
      await discardUpload(supabase, path);
      return { status: "error", message: SAVE_FAILED_MESSAGE };
    }
  } catch (err) {
    console.error("[admin/generations] create failed unexpectedly:", describeError(err));
    return { status: "error", message: GENERATION_FAILED_MESSAGE };
  }

  // Outside the try: redirect() works by throwing.
  redirect("/admin/generations?created=1");
}

const GENERATIONS_PATH = "/admin/generations";

// Returns to the list the admin came from (same filters/page), with a
// success flag. Only paths on the generations list are accepted.
function deletedRedirectPath(raw: string | null): string {
  const fallback = `${GENERATIONS_PATH}?deleted=1`;
  if (!raw) return fallback;
  try {
    const base = "http://admin.local";
    const url = new URL(raw, base);
    if (url.origin !== base || url.pathname !== GENERATIONS_PATH) return fallback;
    url.searchParams.delete("created");
    url.searchParams.set("deleted", "1");
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

// Deletes the generation row only. Associated votes are expected to be
// removed by the database (votes.generation_id ... ON DELETE CASCADE); they
// are never deleted here. The Storage image is intentionally left in place:
// other generations (and the images table) may reference the same file.
// Files are deleted from /admin/images instead.
export async function deleteGeneration(
  _prev: DeleteGenerationState,
  formData: FormData,
): Promise<DeleteGenerationState> {
  const { supabase } = await requireSuperadmin();

  const id = field(formData, "id")?.trim() ?? "";
  if (!/^[1-9][0-9]{0,18}$/.test(id)) {
    return { status: "error", message: "Invalid generation." };
  }

  const { data, error } = await supabase
    .from("generations")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23503") {
      console.error(
        "[admin/generations] delete blocked by a foreign key (23503). " +
          "The votes FK is likely not ON DELETE CASCADE:",
        error.message,
      );
    } else {
      console.error("[admin/generations] delete failed:", error.code, error.message);
    }
    return { status: "error", message: "Couldn't delete this generation. Please try again." };
  }
  if (!data || data.length === 0) {
    return {
      status: "error",
      message: "This generation no longer exists or you don't have permission to delete it.",
    };
  }

  redirect(deletedRedirectPath(field(formData, "return_to")));
}
