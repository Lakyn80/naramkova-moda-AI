import type { MetadataRoute } from "next";

import { slugify } from "../lib/slugify";
import type { Product } from "../lib/types";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "http://localhost:3002";
const BACKEND_URL = process.env.NMM_BACKEND_URL || "http://backend:8080";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL.replace(/\/$/, "");
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/shop`, lastModified: now },
    { url: `${base}/products`, lastModified: now },
  ];

  try {
    const res = await fetch(`${BACKEND_URL}/api/products/`, { cache: "no-store" });
    if (res.ok) {
      const items = (await res.json()) as Product[];
      items.forEach((p) => {
        if (!p?.name) return;
        const slug = slugify(p.name);
        entries.push({ url: `${base}/products/${slug}`, lastModified: now });
      });
    }
  } catch {
    // ignore
  }

  return entries;
}
