import type { Category, DeepseekResult, Product, VisionResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export function buildApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(buildApiUrl("/api/products"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load products (${res.status})`);
  }
  const data = (await res.json()) as Product[];
  return data;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(buildApiUrl("/api/categories"), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load categories (${res.status})`);
  }
  const data = (await res.json()) as Category[];
  return data;
}

export async function createProduct(formData: FormData): Promise<Product> {
  const res = await fetch(buildApiUrl("/api/products"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = `Failed to create product (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data?.error || data?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as Product;
}

export async function analyzeImage(formData: FormData): Promise<VisionResult> {
  const res = await fetch(buildApiUrl("/api/ai/vision/analyze"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = `Failed to analyze image (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data?.error || data?.message || message;
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
    let message = `Failed to generate description (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data?.error || data?.message || message;
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
    let message = `Failed to search RAG (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data?.error || data?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}
