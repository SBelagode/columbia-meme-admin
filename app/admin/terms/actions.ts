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

const MAX_TERM = 200;
const MAX_DEFINITION = 2_000;
const DUPLICATE = { duplicate: "That term already exists." };

type TermValues = { term: string; definition: string | null; is_active: boolean };

function parseTerm(formData: FormData): Parsed<TermValues> {
  const term = textField(formData, "term");
  const definition = textField(formData, "definition");
  if (!term) return invalid("Term can't be empty.");
  if (term.length > MAX_TERM) return invalid(`Term must be ${MAX_TERM} characters or fewer.`);
  if (definition.length > MAX_DEFINITION) {
    return invalid(`Definition must be ${MAX_DEFINITION.toLocaleString()} characters or fewer.`);
  }
  return {
    ok: true,
    values: {
      term,
      definition: definition || null,
      is_active: checkboxField(formData, "is_active"),
    },
  };
}

export async function createTerm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const parsed = parseTerm(formData);
  if (!parsed.ok) return fail(parsed.error);
  return insertRow(supabase, "terms", "terms", parsed.values, "Term created.", DUPLICATE);
}

export async function updateTerm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid term.");
  const parsed = parseTerm(formData);
  if (!parsed.ok) return fail(parsed.error);
  return updateRow(supabase, "terms", "terms", id, parsed.values, "Changes saved.", DUPLICATE);
}

export async function deleteTerm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid term.");
  return deleteRow(supabase, "terms", "terms", id, "Term deleted.");
}
