/**
 * Pulls the server's own explanation out of a failed request.
 *
 * The API answers a refused write with a sentence meant to be read — "This
 * activity is on 3 tours. Remove it from them before deleting it." — and
 * customFetch keeps that body on ApiError.data. Without this the admin screens
 * fall back to a bare "Error" toast, which tells the person nothing about what
 * to change: a duplicate slug, a group that still has activities and an
 * expired session all look identical.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown } | null)?.data;
  if (data && typeof data === "object") {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
