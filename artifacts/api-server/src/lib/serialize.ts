/**
 * Serializes Date objects to ISO strings so Zod response schemas
 * (which expect string for date fields) can parse DB rows cleanly.
 */
export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
