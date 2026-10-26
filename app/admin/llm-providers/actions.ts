"use server";

import { requireSuperadmin } from "@/lib/auth";
import { deleteRow, insertRow, updateRow } from "@/lib/admin/crud";
import {
  SLUG_PATTERN,
  checkboxField,
  fail,
  invalid,
  isUuid,
  textField,
  type ActionState,
  type Parsed,
} from "@/lib/admin/forms";

const MESSAGES = {
  duplicate: "A provider with that slug already exists.",
  inUse: "This provider still has models. Delete its models first.",
};

type ProviderValues = { name: string; slug: string; is_active: boolean };

function parseProvider(formData: FormData): Parsed<ProviderValues> {
  const name = textField(formData, "name");
  const slug = textField(formData, "slug").toLowerCase();
  if (!name || name.length > 100) return invalid("Name must be 1–100 characters.");
  if (!SLUG_PATTERN.test(slug) || slug.length > 100) {
    return invalid("Slug must be lowercase letters and numbers separated by single hyphens, e.g. google-gemini.");
  }
  return { ok: true, values: { name, slug, is_active: checkboxField(formData, "is_active") } };
}

export async function createProvider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const parsed = parseProvider(formData);
  if (!parsed.ok) return fail(parsed.error);
  return insertRow(supabase, "llm-providers", "llm_providers", parsed.values, "Provider created.", MESSAGES);
}

export async function updateProvider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid provider.");
  const parsed = parseProvider(formData);
  if (!parsed.ok) return fail(parsed.error);
  return updateRow(supabase, "llm-providers", "llm_providers", id, parsed.values, "Changes saved.", MESSAGES);
}

// llm_models.provider_id is ON DELETE RESTRICT, so a provider with models
// can't be deleted; the 23503 is reported as MESSAGES.inUse.
export async function deleteProvider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid provider.");
  return deleteRow(supabase, "llm-providers", "llm_providers", id, "Provider deleted.", MESSAGES);
}
