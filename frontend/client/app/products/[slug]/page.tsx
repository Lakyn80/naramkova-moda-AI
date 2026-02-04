import type { Metadata } from "next";

import { slugify } from "../../../lib/slugify";
import type { Product } from "../../../lib/types";
import ProductDetailClient from "./ProductDetailClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "http://localhost:3002";
const BACKEND_URL = process.env.NMM_BACKEND_URL || "http://backend:8080";

function toAbsoluteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = SITE_URL.replace(/\/$/, "");
  if (value.startsWith("/")) return `${base}${value}`;
  return `${base}/static/uploads/${value}`;
}

async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/products/`, { cache: "no-store" });
    if (!res.ok) return null;
    const items = (await res.json()) as Product[];
    return (
      items.find((p) => slugify(p?.name || "") === slug || String(p.id) === slug) || null
    );
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = params.slug;
  const product = await fetchProductBySlug(slug);
  if (!product) {
    return {
      title: "Produkt nenalezen",
      description: "Produkt nebyl nalezen.",
    };
  }

  const title = product.seo_title || product.name || "Produkt";
  const descSource = product.seo_description || product.description || "";
  const description =
    descSource.length > 160 ? `${descSource.slice(0, 159).trim()}…` : descSource;
  const canonical = `${SITE_URL.replace(/\/$/, "")}/products/${slugify(product.name || slug)}`;
  const imageUrl = toAbsoluteUrl(product.image_url || product.image);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
      type: "product",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  return <ProductDetailClient slug={params.slug} />;
}
