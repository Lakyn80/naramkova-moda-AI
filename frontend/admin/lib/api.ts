import type { Category, DeepseekResult, Product, VisionResult } from "./types";

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

export async function fetchProduct(productId: number): Promise<Product> {
  const res = await fetch(buildApiUrl(`/api/products/${productId}`), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Nepodařilo se načíst produkt (${res.status})`);
  }
  return (await res.json()) as Product;
}


export async function fetchCategory(categoryId: number): Promise<Category> {
  const res = await fetch(buildApiUrl(`/api/categories/${categoryId}`), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Nepodařilo se načíst kategorii (${res.status})`);
  }
  return (await res.json()) as Category;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(buildApiUrl("/api/categories/"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Nepodařilo se načíst kategorie (${res.status})`);
  }
  return (await res.json()) as Category[];
}

export async function createCategory(payload: Partial<Category>): Promise<Category> {
  const res = await fetch(buildApiUrl("/api/categories/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `Nepodařilo se vytvořit kategorii (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as Category;
}

export async function updateCategory(categoryId: number, payload: Partial<Category>): Promise<Category> {
  const res = await fetch(buildApiUrl(`/api/categories/${categoryId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `Nepodařilo se uložit kategorii (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as Category;
}

export async function deleteCategory(categoryId: number, force = false): Promise<void> {
  const url = force ? `/api/categories/${categoryId}?force=true` : `/api/categories/${categoryId}`;
  const res = await fetch(buildApiUrl(url), {
    method: "DELETE",
  });
  if (!res.ok) {
    let message = `Nepodařilo se smazat kategorii (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

export async function createProduct(formData: FormData): Promise<Product> {
  const res = await fetch(buildApiUrl("/api/products/"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = `Nepodařilo se vytvořit produkt (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as Product;
}

export async function updateProduct(productId: number, formData: FormData): Promise<Product> {
  const res = await fetch(buildApiUrl(`/api/products/${productId}`), {
    method: "PUT",
    body: formData,
  });

  if (!res.ok) {
    let message = `Nepodařilo se uložit produkt (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as Product;
}

export async function deleteProduct(productId: number): Promise<void> {
  const res = await fetch(buildApiUrl(`/api/products/${productId}`), {
    method: "DELETE",
  });

  if (!res.ok) {
    let message = `Nepodařilo se smazat produkt (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

export async function analyzeImage(formData: FormData): Promise<VisionResult> {
  const res = await fetch(buildApiUrl("/api/ai/vision/analyze"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = `Analýza obrázku selhala (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as VisionResult;
}

export async function generateDescription(context: string): Promise<DeepseekResult> {
  const res = await fetch(buildApiUrl("/api/ai/deepseek/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context }),
  });

  if (!res.ok) {
    let message = `Generování popisu selhalo (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as DeepseekResult;
}

export async function ingestRag(payload: {
  category: string;
  attributes: { labels: string[]; colors: string[]; objects: string[] };
  description: string;
}): Promise<void> {
  await fetch(buildApiUrl("/api/ai/rag/ingest"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function searchRag(payload: {
  category: string;
  attributes: { labels: string[]; colors: string[]; objects: string[] };
}): Promise<unknown> {
  const res = await fetch(buildApiUrl("/api/ai/rag/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `Vyhledávání v RAG selhalo (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export async function deleteMedia(mediaId: number): Promise<void> {
  const res = await fetch(buildApiUrl(`/api/media/${mediaId}`), {
    method: "DELETE",
  });

  if (!res.ok) {
    let message = `Smazání média selhalo (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string; detail?: string };
      message = data?.error || data?.message || data?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

