// Helpers for reading rows with embedded relations from supabase-js.

/** Supabase returns an embedded to-one relation as an object (or, without a
 *  detected unique key, a one-element array). */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Reads the count from an embedded `table(count)` aggregate. */
export function embeddedCount(value: { count: number }[] | null | undefined): number {
  return value?.[0]?.count ?? 0;
}

export function personName(
  p: { first_name: string | null; last_name: string | null } | null | undefined,
): string | null {
  if (!p) return null;
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null;
}
