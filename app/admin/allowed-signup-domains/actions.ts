"use server";

import { requireSuperadmin } from "@/lib/auth";
import { deleteRow, insertRow, updateRow } from "@/lib/admin/crud";
import {
  DOMAIN_PATTERN,
  checkboxField,
  fail,
  invalid,
  isUuid,
  textField,
  type ActionState,
  type Parsed,
} from "@/lib/admin/forms";

const DUPLICATE = { duplicate: "That domain is already on the list." };

type DomainValues = { domain: string; is_active: boolean };

// Accepts "columbia.edu", "@columbia.edu" or "COLUMBIA.EDU" and stores the
// lowercase form the CHECK constraint requires.
function parseDomain(formData: FormData): Parsed<DomainValues> {
  const domain = textField(formData, "domain").toLowerCase().replace(/^@/, "");
  if (!domain || domain.length > 253 || !DOMAIN_PATTERN.test(domain)) {
    return invalid("Enter a domain like columbia.edu (no @, spaces or paths).");
  }
  return { ok: true, values: { domain, is_active: checkboxField(formData, "is_active") } };
}

export async function createDomain(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const parsed = parseDomain(formData);
  if (!parsed.ok) return fail(parsed.error);
  return insertRow(supabase, "allowed-signup-domains", "allowed_signup_domains", parsed.values, "Domain added.", DUPLICATE);
}

export async function updateDomain(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid domain.");
  const parsed = parseDomain(formData);
  if (!parsed.ok) return fail(parsed.error);
  return updateRow(supabase, "allowed-signup-domains", "allowed_signup_domains", id, parsed.values, "Changes saved.", DUPLICATE);
}

export async function deleteDomain(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperadmin();
  const id = textField(formData, "id");
  if (!isUuid(id)) return fail("Invalid domain.");
  return deleteRow(supabase, "allowed-signup-domains", "allowed_signup_domains", id, "Domain removed.");
}
