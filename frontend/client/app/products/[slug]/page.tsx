"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "../../../lib/types";
import { fetchProducts } from "../../../lib/api";


function formatPrice(value?: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)} Kč`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function ProductDetailPage() {
  const params = useParams();
  const slugParam = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchProducts()
      .then((data) => {
        if (!active) return;
        setProducts(data);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message || "Nepodařilo se načíst produkt");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const product = useMemo(() => {
    if (!slugParam) return undefined;
    const numericId = Number(slugParam);
    if (Number.isInteger(numericId)) {
      return products.find((item) => item.id === numericId);
    }
    return products.find((item) => slugify(item.name) === slugParam);
  }, [products, slugParam]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Načítání...
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Produkt nenalezen. <Link href="/products" className="underline">Zpět na produkty</Link>
          </div>
        </div>
      </main>
    );
  }

  const imageUrl = product.image_url ? `${STATIC_BASE}${product.image_url}` : "";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/products" className="text-sm text-gray-500 underline">
          Zpět na produkty
        </Link>
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="h-80 w-full object-cover" />
            ) : (
              <div className="flex h-80 items-center justify-center text-sm text-gray-400">Bez obrázku</div>
            )}
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <div className="text-lg font-semibold text-gray-900">{formatPrice(product.price)}</div>
            {product.category_name && (
              <div className="text-sm text-gray-500">Kategorie: {product.category_name}</div>
            )}
            {product.description && (
              <p className="text-sm text-gray-700 whitespace-pre-line">{product.description}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

