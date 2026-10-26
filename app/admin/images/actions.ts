"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth";
import { updateRow } from "@/lib/admin/crud";
import { IMAGE_EXTENSIONS, sniffImageType } from "@/lib/admin/caption-generation";
import { MAX_IMAGE_BYTES, MAX_IMAGE_LABEL, MEME_BUCKET } from "@/lib/admin/meme-images";
import { fail, isUuid, textField, type ActionState } from "@/lib/admin/forms";

type SupabaseClient = Awaited<ReturnType<typeof requireSuperadmin>>["supabase"];

const MAX_DESCRIPTION = 500;
const UPLOAD_FAILED_MESSAGE = "The image couldn't be uploaded. Please try again.";
const SAVE_FAILED_MESSAGE = "The image was uploaded but couldn't be saved. Please try again.";
const DELETE_FAILED_MESSAGE = "Couldn't delete this image. Please try again.";
const STORAGE_DELETE_FAILED_MESSAGE =
  "The file couldn't be removed from Storage, so the image was not deleted. Please try again.";
const GONE_MESSAGE = "This image no longer exists or you don't have permission to delete it.";

function parseDescription(formData: FormData): string | null | undefined {
  const description = textField(formData, "description");
  if (description.length > MAX_DESCRIPTION) return undefined;
  return description || null;
}

// Best effort; same as the generations flow.
async function discardUpload(supabase: SupabaseClient, path: string) {
  const { error } = await supabase.storage.from(MEME_BUCKET).remove([path]);
  if (error) console.error("[admin/images] cleanup of unused upload failed:", error.message);
}

// Validates the bytes (not the browser's MIME type), uploads to
// meme-images/<admin id>/<uuid>.<ext> under the existing own-folder INSERT
// policy, then records the metadata row as the signed-in superadmin.
export async function uploadImage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireSuperadmin();

  const description = parseDescription(formData);
  if (description === undefined) {
    return fail(`Alt text must be ${MAX_DESCRIPTION} characters or fewer.`);
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return fail("Please choose an image first.");
  if (file.size > MAX_IMAGE_BYTES) return fail(`Images must be ${MAX_IMAGE_LABEL} or smaller.`);

  try {
    const bytes = await file.arrayBuffer();
    const mimeType = sniffImageType(bytes);
    if (!mimeType) return fail("Please upload a JPEG, PNG, or WebP image.");

    const path = `${user.id}/${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`;
    const { error: uploadError } = await supabase.storage
      .from(MEME_BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) {
      console.error("[admin/images] upload failed:", uploadError.message);
      return fail(UPLOAD_FAILED_MESSAGE);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(MEME_BUCKET).getPublicUrl(path);

    const { error } = await supabase.from("images").insert({
      user_id: user.id,
      storage_bucket: MEME_BUCKET,
      storage_path: path,
      public_url: publicUrl,
      mime_type: mimeType,
      size_bytes: bytes.byteLength,
      description,
    });
    if (error) {
      console.error("[admin/images] insert failed:", error.code, error.message);
      await discardUpload(supabase, path);
      return fail(SAVE_FAILED_MESSAGE);
    }
  } catch (err) {
    console.error("[admin/images] upload failed unexpectedly:", err instanceof Error ? err.message : err);
    return fail(UPLOAD_FAILED_MESSAGE);
  }

  refresh();
  return { status: "success", message: "Image uploaded." };
}

// Only the alt text is editable; the file, path and URL are fixed.
export async function updateImage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid image.");
  const description = parseDescription(formData);
  if (description === undefined) {
    return fail(`Alt text must be ${MAX_DESCRIPTION} characters or fewer.`);
  }
  return updateRow(supabase, "images", "images", id, { description }, "Changes saved.");
}

async function countGenerations(
  supabase: SupabaseClient,
  column: "image_id" | "source_image_url",
  value: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("generations")
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    console.error("[admin/images] usage check failed:", error.code, error.message);
    return null;
  }
  return count ?? 0;
}

// Object paths this action will remove: <folder>/<file>.<ext>, no traversal.
const STORAGE_PATH_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_.-]+)+$/;

// Removes the Storage object first, confirms it is really gone, and only then
// deletes the images row. If the row delete then fails, retrying is safe: the
// object is already absent, which the existence check accepts.
// Refuses while a generation still shows this file, since removing it would
// break that meme. Examples and requests that reference the image keep their
// rows (image_id becomes NULL).
export async function deleteImage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid image.");

  const { data: image, error: readError } = await supabase
    .from("images")
    .select("id, storage_bucket, storage_path, public_url")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("[admin/images] lookup failed:", readError.code, readError.message);
    return fail(DELETE_FAILED_MESSAGE);
  }
  if (!image) return fail(GONE_MESSAGE);

  // Only objects in the bucket this admin manages, at a well-formed path.
  if (
    image.storage_bucket !== MEME_BUCKET ||
    image.storage_path.includes("..") ||
    !STORAGE_PATH_PATTERN.test(image.storage_path)
  ) {
    console.error("[admin/images] refusing delete of unexpected object:", image.storage_bucket, image.storage_path);
    return fail(DELETE_FAILED_MESSAGE);
  }

  const [byId, byUrl] = await Promise.all([
    countGenerations(supabase, "image_id", image.id),
    countGenerations(supabase, "source_image_url", image.public_url),
  ]);
  if (byId === null || byUrl === null) return fail(DELETE_FAILED_MESSAGE);
  const inUse = Math.max(byId, byUrl);
  if (inUse > 0) {
    return fail(
      `This image is used by ${inUse} ${inUse === 1 ? "generation" : "generations"}. Delete ${inUse === 1 ? "it" : "them"} first.`,
    );
  }

  const bucket = supabase.storage.from(MEME_BUCKET);

  // 1. Remove the object. Storage RLS skips objects it doesn't allow without
  //    an error, so the result alone isn't proof; step 2 checks.
  const { data: removed, error: removeError } = await bucket.remove([image.storage_path]);
  if (removeError) {
    console.error("[admin/images] storage remove failed:", removeError.message);
    return fail(STORAGE_DELETE_FAILED_MESSAGE);
  }

  // 2. Verify with an authenticated existence check (needs the superadmin
  //    SELECT policy). exists() reports a missing object as data: false
  //    *with* an error (HEAD 400/404), and throws on any other failure. Only
  //    a definite "absent" continues; otherwise the row stays in place.
  let stillExists: boolean;
  try {
    ({ data: stillExists } = await bucket.exists(image.storage_path));
  } catch (err) {
    console.error(
      "[admin/images] storage existence check failed:",
      err instanceof Error ? err.message : err,
    );
    return fail(STORAGE_DELETE_FAILED_MESSAGE);
  }
  if (stillExists) {
    console.error("[admin/images] storage object still present after remove:", image.storage_path);
    return fail(STORAGE_DELETE_FAILED_MESSAGE);
  }
  if (!removed || removed.length === 0) {
    // Absent but not removed by this call: an earlier attempt already removed
    // it (the retry case), or it was deleted outside the admin.
    console.warn("[admin/images] storage object was already absent:", image.storage_path);
  }

  // 3. The file is gone; remove the metadata row.
  const { data: deleted, error } = await supabase
    .from("images")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[admin/images] row delete failed after storage removal:", error.code, error.message);
    return fail("The file was removed, but the image record couldn't be deleted. Please try again.");
  }
  if (!deleted || deleted.length === 0) return fail(GONE_MESSAGE);

  redirect("/admin/images?deleted=1");
}
