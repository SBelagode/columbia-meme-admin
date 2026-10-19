// Helpers for reading admin filter query parameters safely.

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parsePageParam(params: SearchParams): number {
  return Math.max(1, Math.floor(Number(firstParam(params.page))) || 1);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A user ID (auth UUID) from the URL, or null if absent/malformed. */
export function parseUserIdParam(value: string | string[] | undefined): string | null {
  const v = firstParam(value).trim();
  return UUID_PATTERN.test(v) ? v : null;
}

/** A bigint row ID (generations.id, votes.id) from the URL, or null. */
export function parseBigintIdParam(value: string | string[] | undefined): string | null {
  const v = firstParam(value).trim();
  return /^[1-9][0-9]{0,18}$/.test(v) ? v : null;
}

/** Builds a path with only the non-empty params, in the given order. */
export function buildHref(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export function shortId(id: string | number): string {
  const s = String(id);
  return s.length > 13 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
