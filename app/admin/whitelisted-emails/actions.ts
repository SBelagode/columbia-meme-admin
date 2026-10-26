"use server";

import { requireSuperadmin } from "@/lib/auth";
import { deleteRow, insertRow, updateRow } from "@/lib/admin/crud";
import {
  EMAIL_PATTERN,
  checkboxField,
  fail,
  invalid,
  isUuid,
  textField,
  type ActionState,
  type Parsed,
} from "@/lib/admin/forms";

const DUPLICATE = { duplicate: "That email is already whitelisted." };
const MAX_NOTE = 500;

type EmailValues = { email: string; note: string | null; is_active: boolean };

// Stored lowercase, as the CHECK constraint requires.
function parseEmail(formData: FormData): Parsed<EmailValues> {
  const email = textField(formData, "email").toLowerCase();
  const note = textField(formData, "note");
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return invalid("Enter a valid email address.");
  }
  if (note.length > MAX_NOTE) return invalid(`Note must be ${MAX_NOTE} characters or fewer.`);
  return {
    ok: true,
    values: { email, note: note || null, is_active: checkboxField(formData, "is_active") },
  };
}

export async function createEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const parsed = parseEmail(formData);
  if (!parsed.ok) return fail(parsed.error);
  return insertRow(supabase, "whitelisted-emails", "whitelisted_emails", parsed.values, "Email added.", DUPLICATE);
}

export async function updateEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid email entry.");
  const parsed = parseEmail(formData);
  if (!parsed.ok) return fail(parsed.error);
  return updateRow(supabase, "whitelisted-emails", "whitelisted_emails", id, parsed.values, "Changes saved.", DUPLICATE);
}

export async function deleteEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid email entry.");
  return deleteRow(supabase, "whitelisted-emails", "whitelisted_emails", id, "Email removed.");
}
