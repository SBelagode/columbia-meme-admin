// Values allowed by the status CHECK constraints.
export const REQUEST_STATUSES = ["pending", "succeeded", "failed", "blocked"] as const;
export const RESPONSE_STATUSES = ["succeeded", "failed", "blocked"] as const;

export function parseStatusParam<T extends string>(
  value: string,
  allowed: readonly T[],
): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}
