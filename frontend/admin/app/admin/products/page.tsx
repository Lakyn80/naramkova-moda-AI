"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Product } from "../../../lib/types";
import { fetchProducts } from "../../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function formatPrice(value?: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)} Kč`;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("cs-CZ");
  } catch {
    return value;
  }
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

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
        setError(err.message || "Failed to load products");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => products, [products]);
  const created = searchParams.get("created") === "1";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Produkty</h1>
          <p className="text-sm text-gray-500">Seznam produktů z API.</p>
        </div>

        {created && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Produkt byl úspěšně vytvořen.
          </div>
        )}

        {loading && (
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Načítání...
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((product) => {
                  const imageUrl = product.image_url ? `${API_BASE}${product.image_url}` : "";
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded bg-gray-200" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3">{formatPrice(product.price)}</td>
                      <td className="px-4 py-3">{product.stock ?? "-"}</td>
                      <td className="px-4 py-3">{product.category_name ?? "-"}</td>
                      <td className="px-4 py-3">{formatDate(product.created_at ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
