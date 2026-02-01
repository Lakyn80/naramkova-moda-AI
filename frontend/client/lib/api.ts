import type { Category, Product } from "./types";

const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:8080");
export function resolveApiBase(): string {
  if (RAW_API_BASE.includes("backend")) {
    return "/api";
  }
  return RAW_API_BASE;
}
export const API_BASE = resolveApiBase();
export const STATIC_BASE = API_BASE === "/api" ? "" : API_BASE;

export function buildApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE === "/api") {
    if (normalized.startsWith("/api/") || normalized === "/api") {
      return normalized;
    }
    return `/api${normalized}`;
  }
  return `${API_BASE}${normalized}`;
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(buildApiUrl("/api/products/"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Nepodařilo se načíst produkty (${res.status})`);
  }
  return (await res.json()) as Product[];
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(buildApiUrl("/api/categories/"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Nepodařilo se načíst kategorie (${res.status})`);
  }
  return (await res.json()) as Category[];
}

export async function fetchCategoryBySlug(slug: string): Promise<Category> {
  const res = await fetch(buildApiUrl(`/api/categories//${slug}`), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Nepodařilo se načíst kategorii (${res.status})`);
  }
  return (await res.json()) as Category;
}
