"use server";

import { requireSuperadmin } from "@/lib/auth";
import { deleteRow, insertRow, updateRow } from "@/lib/admin/crud";
import {
  checkboxField,
  fail,
  invalid,
  isUuid,
  textField,
  type ActionState,
  type Parsed,
} from "@/lib/admin/forms";

const MESSAGES = {
  duplicate: "That provider already has a model with this identifier.",
  inUse: "The selected provider no longer exists.",
};

type ModelValues = {
  provider_id: string;
  model_identifier: string;
  display_name: string;
  supports_images: boolean;
  is_active: boolean;
};

function parseModel(formData: FormData): Parsed<ModelValues> {
  const providerId = textField(formData, "provider_id");
  const modelIdentifier = textField(formData, "model_identifier");
  const displayName = textField(formData, "display_name");
  if (!isUuid(providerId)) return invalid("Please choose a provider.");
  if (!modelIdentifier || modelIdentifier.length > 200) {
    return invalid("Model identifier must be 1–200 characters.");
  }
  if (/\s/.test(modelIdentifier)) return invalid("Model identifier can't contain spaces.");
  if (!displayName || displayName.length > 200) return invalid("Display name must be 1–200 characters.");
  return {
    ok: true,
    values: {
      provider_id: providerId,
      model_identifier: modelIdentifier,
      display_name: displayName,
      supports_images: checkboxField(formData, "supports_images"),
      is_active: checkboxField(formData, "is_active"),
    },
  };
}

export async function createModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const parsed = parseModel(formData);
  if (!parsed.ok) return fail(parsed.error);
  return insertRow(supabase, "llm-models", "llm_models", parsed.values, "Model created.", MESSAGES);
}

export async function updateModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid model.");
  const parsed = parseModel(formData);
  if (!parsed.ok) return fail(parsed.error);
  return updateRow(supabase, "llm-models", "llm_models", id, parsed.values, "Changes saved.", MESSAGES);
}

// Requests, responses, steps and generations that used this model keep
// their rows; their llm_model_id is set to NULL by the database.
export async function deleteModel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid model.");
  return deleteRow(supabase, "llm-models", "llm_models", id, "Model deleted.");
}
