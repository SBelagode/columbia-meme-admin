"use server";

import { requireSuperadmin } from "@/lib/auth";
import { updateRow } from "@/lib/admin/crud";
import { checkboxField, fail, isUuid, textField, type ActionState } from "@/lib/admin/forms";

// Matches the CHECK constraint on prompt_chain_mix.weight.
const MAX_WEIGHT = 1000;

// UPDATE only: the mix has no create or delete. Only weight and is_active
// are writable; prompt_chain_id is never read from the form.
export async function updateMix(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();

  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid mix entry.");

  const rawWeight = textField(formData, "weight");
  const weight = Number(rawWeight);
  if (!/^\d+$/.test(rawWeight) || weight > MAX_WEIGHT) {
    return fail(`Weight must be a whole number from 0 to ${MAX_WEIGHT}.`);
  }

  return updateRow(
    supabase,
    "prompt-chain-mix",
    "prompt_chain_mix",
    id,
    { weight, is_active: checkboxField(formData, "is_active") },
    "Changes saved.",
  );
}
