"use server";

import { requireSuperadmin } from "@/lib/auth";
import { deleteRow, insertRow, updateRow } from "@/lib/admin/crud";
import {
  checkboxField,
  fail,
  invalid,
  isUuid,
  optionalUuidField,
  textField,
  type ActionState,
  type Parsed,
} from "@/lib/admin/forms";

// Matches the caption CHECK on generation_examples and MAX_GENERATED_TEXT.
const MAX_CAPTION = 5_000;
const MAX_NOTES = 2_000;
const MESSAGES = { inUse: "The selected image or prompt chain no longer exists." };

type ExampleValues = {
  caption: string;
  notes: string | null;
  image_id: string | null;
  prompt_chain_id: string | null;
  is_active: boolean;
};

function parseExample(formData: FormData): Parsed<ExampleValues> {
  const caption = textField(formData, "caption");
  const notes = textField(formData, "notes");
  const imageId = optionalUuidField(formData, "image_id");
  const promptChainId = optionalUuidField(formData, "prompt_chain_id");
  if (!caption) return invalid("Caption can't be empty.");
  if (caption.length > MAX_CAPTION) {
    return invalid(`Caption must be ${MAX_CAPTION.toLocaleString()} characters or fewer.`);
  }
  if (notes.length > MAX_NOTES) {
    return invalid(`Notes must be ${MAX_NOTES.toLocaleString()} characters or fewer.`);
  }
  if (imageId === undefined) return invalid("Invalid image.");
  if (promptChainId === undefined) return invalid("Invalid prompt chain.");
  return {
    ok: true,
    values: {
      caption,
      notes: notes || null,
      image_id: imageId,
      prompt_chain_id: promptChainId,
      is_active: checkboxField(formData, "is_active"),
    },
  };
}

export async function createExample(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const parsed = parseExample(formData);
  if (!parsed.ok) return fail(parsed.error);
  return insertRow(supabase, "generation-examples", "generation_examples", parsed.values, "Example created.", MESSAGES);
}

export async function updateExample(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid example.");
  const parsed = parseExample(formData);
  if (!parsed.ok) return fail(parsed.error);
  return updateRow(supabase, "generation-examples", "generation_examples", id, parsed.values, "Changes saved.", MESSAGES);
}

// Deletes the example only; the linked image is left alone.
export async function deleteExample(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid example.");
  return deleteRow(supabase, "generation-examples", "generation_examples", id, "Example deleted.");
}
