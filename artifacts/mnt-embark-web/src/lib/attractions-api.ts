/**
 * The attractions API, typed by hand.
 *
 * Same reasoning as lib/airlines-api.ts: these endpoints are not in the
 * OpenAPI spec, so they are called with plain fetch and typed here. Nothing
 * outside this file knows the URLs.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type Classification = "standard" | "special" | "exclusive";
export type StepKind = "reach" | "prepare" | "custom";

export interface AttractionStep {
  kind: StepKind;
  title: string;
  description: string;
  images: string[];
}

/** Mirrors lib/db FIXED_STEP_TITLES. */
export const FIXED_STEP_TITLES = {
  reach: "How to reach",
  prepare: "What to prepare",
} as const;

export const MAX_ATTRACTION_STEPS = 10;
export const MAX_CATEGORIES = 5;
export const MAX_ACTIVITIES = 10;

interface Ref {
  id: number;
  slug: string;
  name: string;
}

export interface Attraction {
  id: number;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  coverImage: string;
  images: string[];
  classification: Classification;
  featured: boolean;
  visitDuration: string | null;
  priceFrom: number | null;
  hotelsAvailable: boolean;
  stayNote: string | null;
  steps: AttractionStep[];
  isActive: boolean;
  displayOrder: number;
  location: Ref;
  country: (Ref & { code: string | null }) | null;
  /** Main category first. */
  categories: Ref[];
  activities: (Ref & { groupSlug: string; groupName: string })[];
  destinationIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface AttractionInput {
  slug?: string;
  name: string;
  summary: string | null;
  description: string;
  coverImage: string;
  images: string[];
  locationId: number;
  classification: Classification;
  featured: boolean;
  visitDuration: string | null;
  priceFrom: number | null;
  hotelsAvailable: boolean;
  stayNote: string | null;
  steps: AttractionStep[];
  isActive: boolean;
  displayOrder: number;
  categoryIds: number[];
  activityIds: number[];
}

export interface AttractionFilters {
  q?: string;
  categorySlug?: string;
  destinationSlug?: string;
  countrySlug?: string;
  locationSlug?: string;
  classification?: string[];
  activitySlugs?: string[];
  featured?: boolean;
}

/* ------------------------------------------------------------------ fetch */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: "include",
    ...init,
    headers: init?.body != null ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

function toQuery(f: AttractionFilters): string {
  const p = new URLSearchParams();
  for (const k of ["q", "categorySlug", "destinationSlug", "countrySlug", "locationSlug"] as const) {
    const v = f[k]?.trim();
    if (v) p.set(k, v);
  }
  for (const c of f.classification ?? []) p.append("classification", c);
  for (const a of f.activitySlugs ?? []) p.append("activitySlugs", a);
  if (f.featured) p.set("featured", "true");
  const s = p.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------ public */

export function useAttractions(filters: AttractionFilters = {}, options?: { enabled?: boolean }) {
  const qs = toQuery(filters);
  return useQuery<Attraction[], Error>({
    queryKey: ["attractions", "list", qs],
    queryFn: () => request<Attraction[]>(`/attractions${qs}`),
    enabled: options?.enabled ?? true,
  });
}

export function useAttraction(slug: string) {
  return useQuery<Attraction, Error>({
    queryKey: ["attractions", "detail", slug],
    queryFn: () => request<Attraction>(`/attractions/${encodeURIComponent(slug)}`),
    enabled: Boolean(slug),
    retry: false, // A 404 is an answer.
  });
}

/* ------------------------------------------------------------------- admin */

export function useAdminAttractions() {
  return useQuery<Attraction[], Error>({
    queryKey: ["attractions", "admin"],
    queryFn: () => request<Attraction[]>("/admin/attractions"),
  });
}

/** Every attractions query, public ones included: an edit changes what the site shows. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["attractions"] });
    // Activity filter counts and the about-page stats count attractions.
    void qc.invalidateQueries({ queryKey: ["/api/activities"] });
    void qc.invalidateQueries({ queryKey: ["/api/stats"] });
  };
}

export function useCreateAttraction() {
  const invalidate = useInvalidate();
  return useMutation<Attraction, Error, AttractionInput>({
    mutationFn: (data) => request<Attraction>("/admin/attractions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateAttraction() {
  const invalidate = useInvalidate();
  return useMutation<Attraction, Error, { id: number; data: Partial<AttractionInput> }>({
    mutationFn: ({ id, data }) =>
      request<Attraction>(`/admin/attractions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useDeleteAttraction() {
  const invalidate = useInvalidate();
  return useMutation<void, Error, number>({
    mutationFn: (id) => request<void>(`/admin/attractions/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/* ---------------------------------------------------------------- helpers */

/** "Kyoto, Japan", without repeating a name ("Maldives, Maldives"). */
export function placeOf(a: Pick<Attraction, "location" | "country">): string {
  return [a.location.name, a.country?.name]
    .filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i)
    .join(", ");
}

/* --------------------------------------------------------------- places */

export interface NewLocationInput {
  name: string;
  countryId?: number;
  newCountryName?: string;
}

export interface NewLocationResult {
  id: number;
  name: string;
  countryId: number;
  countryName: string;
  /** False when that place already existed and was returned instead. */
  created: boolean;
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation<NewLocationResult, Error, NewLocationInput>({
    mutationFn: (data) =>
      request<NewLocationResult>("/admin/locations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/locations"] });
      void qc.invalidateQueries({ queryKey: ["/api/countries"] });
    },
  });
}
