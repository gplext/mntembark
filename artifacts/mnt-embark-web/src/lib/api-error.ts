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
  const e = err as { data?: unknown; status?: number } | null;

  const data = e?.data;
  if (data && typeof data === "object") {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }

  /*
   * No sentence to show. Say what actually happened rather than "try again",
   * which is wrong advice for most of these: repeating the same request will
   * fail the same way. The status is what distinguishes a signed-out session
   * from a validation problem from a server fault, and it is the one detail
   * worth quoting when reporting it.
   */
  const status = e?.status;
  if (status === 401) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (status === 413) {
    return "That file is too large to upload.";
  }
  if (typeof status === "number") {
    return `${fallback} (server responded ${status})`;
  }
  return `${fallback} The server could not be reached.`;
}
