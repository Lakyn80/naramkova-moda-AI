"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl, fetchProducts } from "../../../lib/api";
import { resolveMediaUrl } from "../../../lib/media";
import type { Product, ProductVariant } from "../../../lib/types";

type TabKey = "ai" | "second";

type AiInboxItem = {
  id: number;
  filename?: string | null;
  webp_path?: string | null;
  product_type?: string | null;
  status?: string | null;
};

type SecondInboxItem = {
  id: number;
  filename?: string | null;
  webp_path?: string | null;
  status?: string | null;
};

function normalizeError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export default function MediaInboxPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("ai");

  const [aiItems, setAiItems] = useState<AiInboxItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUploading, setAiUploading] = useState(false);
  const [aiUploadError, setAiUploadError] = useState<string | null>(null);

  const [secondItems, setSecondItems] = useState<SecondInboxItem[]>([]);
  const [secondLoading, setSecondLoading] = useState(false);
  const [secondError, setSecondError] = useState<string | null>(null);
  const [secondUploading, setSecondUploading] = useState(false);
  const [secondUploadError, setSecondUploadError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [aiAssignItem, setAiAssignItem] = useState<AiInboxItem | null>(null);
  const [aiAssignProductId, setAiAssignProductId] = useState("");
  const [aiCreateProduct, setAiCreateProduct] = useState(false);
  const [aiAssignError, setAiAssignError] = useState<string | null>(null);
  const [aiAssignSubmitting, setAiAssignSubmitting] = useState(false);

  const [secondAssignItem, setSecondAssignItem] = useState<SecondInboxItem | null>(null);
  const [secondAssignProductId, setSecondAssignProductId] = useState("");
  const [secondAssignVariantId, setSecondAssignVariantId] = useState("");
  const [secondAssignError, setSecondAssignError] = useState<string | null>(null);
  const [secondAssignSubmitting, setSecondAssignSubmitting] = useState(false);

  const aiFileRef = useRef<HTMLInputElement>(null);
  const secondFileRef = useRef<HTMLInputElement>(null);

  const loadProducts = async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await fetchProducts();
      setProducts(data || []);
    } catch (err) {
      setProductsError(normalizeError(err, "Nepodařilo se načíst produkty"));
    } finally {
      setProductsLoading(false);
    }
  };

  const loadAiPending = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(buildApiUrl("/api/media-inbox/pending"), { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Nepodařilo se načíst inbox (${res.status})`);
      }
      const data = (await res.json()) as { items?: AiInboxItem[] };
      setAiItems(data?.items || []);
    } catch (err) {
      setAiError(normalizeError(err, "Nepodařilo se načíst pending položky"));
    } finally {
      setAiLoading(false);
    }
  };

  const loadSecondPending = async () => {
    setSecondLoading(true);
    setSecondError(null);
    try {
      const res = await fetch(buildApiUrl("/api/media-second/pending"), { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Nepodařilo se načíst second inbox (${res.status})`);
      }
      const data = (await res.json()) as { items?: SecondInboxItem[] };
      setSecondItems(data?.items || []);
    } catch (err) {
      setSecondError(normalizeError(err, "Nepodařilo se načíst pending položky"));
    } finally {
      setSecondLoading(false);
    }
  };

  useEffect(() => {
    loadAiPending();
    loadSecondPending();
  }, []);

  useEffect(() => {
    if (aiAssignItem || secondAssignItem) {
      loadProducts();
    }
  }, [aiAssignItem, secondAssignItem]);

  const handleAiFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAiUploading(true);
    setAiUploadError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const res = await fetch(buildApiUrl("/api/media-inbox/upload"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let message = `Upload selhal (${res.status})`;
        try {
          const data = (await res.json()) as { detail?: string; error?: string; message?: string };
          message = data?.detail || data?.error || data?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      await loadAiPending();
    } catch (err) {
      setAiUploadError(normalizeError(err, "Upload selhal"));
    } finally {
      setAiUploading(false);
      if (aiFileRef.current) aiFileRef.current.value = "";
    }
  };

  const handleSecondFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSecondUploading(true);
    setSecondUploadError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const res = await fetch(buildApiUrl("/api/media-second/upload"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let message = `Upload selhal (${res.status})`;
        try {
          const data = (await res.json()) as { detail?: string; error?: string; message?: string };
          message = data?.detail || data?.error || data?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      await loadSecondPending();
    } catch (err) {
      setSecondUploadError(normalizeError(err, "Upload selhal"));
    } finally {
      setSecondUploading(false);
      if (secondFileRef.current) secondFileRef.current.value = "";
    }
  };

  const openAiAssign = (item: AiInboxItem) => {
    setAiAssignItem(item);
    setAiAssignProductId("");
    setAiCreateProduct(false);
    setAiAssignError(null);
  };

  const closeAiAssign = () => {
    setAiAssignItem(null);
    setAiAssignProductId("");
    setAiCreateProduct(false);
    setAiAssignError(null);
    setAiAssignSubmitting(false);
  };

  const openSecondAssign = (item: SecondInboxItem) => {
    setSecondAssignItem(item);
    setSecondAssignProductId("");
    setSecondAssignVariantId("");
    setSecondAssignError(null);
  };

  const closeSecondAssign = () => {
    setSecondAssignItem(null);
    setSecondAssignProductId("");
    setSecondAssignVariantId("");
    setSecondAssignError(null);
    setSecondAssignSubmitting(false);
  };

  const handleAiAssign = async () => {
    if (!aiAssignItem) return;
    if (!aiCreateProduct && !aiAssignProductId) {
      setAiAssignError("Vyberte produkt pro přiřazení.");
      return;
    }

    setAiAssignSubmitting(true);
    setAiAssignError(null);
    try {
      const payload = aiCreateProduct
        ? { inbox_item_id: aiAssignItem.id, create_product: true }
        : { inbox_item_id: aiAssignItem.id, product_id: Number(aiAssignProductId) };

      const res = await fetch(buildApiUrl("/api/media-inbox/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = `Přiřazení selhalo (${res.status})`;
        try {
          const data = (await res.json()) as { detail?: string; error?: string; message?: string };
          message = data?.detail || data?.error || data?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      closeAiAssign();
      await loadAiPending();
    } catch (err) {
      setAiAssignError(normalizeError(err, "Přiřazení selhalo"));
    } finally {
      setAiAssignSubmitting(false);
    }
  };

  const handleSecondAssign = async () => {
    if (!secondAssignItem) return;
    if (!secondAssignProductId && !secondAssignVariantId) {
      setSecondAssignError("Vyberte produkt nebo variantu.");
      return;
    }

    setSecondAssignSubmitting(true);
    setSecondAssignError(null);
    try {
      const payload = secondAssignVariantId
        ? { inbox_item_id: secondAssignItem.id, variant_id: Number(secondAssignVariantId) }
        : { inbox_item_id: secondAssignItem.id, product_id: Number(secondAssignProductId) };

      const res = await fetch(buildApiUrl("/api/media-second/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = `Přiřazení selhalo (${res.status})`;
        try {
          const data = (await res.json()) as { detail?: string; error?: string; message?: string };
          message = data?.detail || data?.error || data?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      closeSecondAssign();
      await loadSecondPending();
    } catch (err) {
      setSecondAssignError(normalizeError(err, "Přiřazení selhalo"));
    } finally {
      setSecondAssignSubmitting(false);
    }
  };

  const selectedSecondProduct = useMemo(() => {
    const id = Number(secondAssignProductId);
    if (!Number.isFinite(id)) return null;
    return products.find((p) => p.id === id) || null;
  }, [products, secondAssignProductId]);

  const secondVariants: ProductVariant[] = selectedSecondProduct?.variants || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Media Inbox</h2>
        <p className="text-sm text-gray-600">
          Hromadný upload obrázků s AI drafty (A) a galerie bez AI (B).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`rounded-md border px-4 py-2 text-sm ${
            activeTab === "ai" ? "border-gray-300 bg-white" : "border-gray-200 bg-gray-100"
          }`}
        >
          AI Inbox (popisy)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("second")}
          className={`rounded-md border px-4 py-2 text-sm ${
            activeTab === "second" ? "border-gray-300 bg-white" : "border-gray-200 bg-gray-100"
          }`}
        >
          Second Inbox (jen galerie)
        </button>
      </div>

      {activeTab === "ai" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => aiFileRef.current?.click()}
                disabled={aiUploading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
              >
                {aiUploading ? "Nahrávám..." : "Nahrát obrázky"}
              </button>
              <input
                ref={aiFileRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(event) => handleAiFiles(event.target.files)}
              />
              <span className="text-xs text-gray-500">Vybrané soubory se zpracují přes AI.</span>
            </div>
            {aiUploadError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {aiUploadError}
              </div>
            )}
          </div>

          {aiLoading && (
            <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">Načítání...</div>
          )}

          {aiError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-600">{aiError}</div>
          )}

          {!aiLoading && !aiError && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aiItems.map((item) => {
                const previewUrl = resolveMediaUrl(item.webp_path || undefined);
                return (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="mb-3 h-40 overflow-hidden rounded bg-gray-100">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={item.filename || "Media"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">
                          Bez náhledu
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="truncate font-medium text-gray-800">{item.filename || "—"}</div>
                      <div>Typ: {item.product_type || "—"}</div>
                      <div>Status: {item.status || "pending"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAiAssign(item)}
                      className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-100"
                    >
                      Přiřadit k produktu
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!aiLoading && !aiError && aiItems.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              Žádné pending položky
            </div>
          )}
        </section>
      )}

      {activeTab === "second" && (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => secondFileRef.current?.click()}
                disabled={secondUploading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
              >
                {secondUploading ? "Nahrávám..." : "Nahrát obrázky do galerie"}
              </button>
              <input
                ref={secondFileRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(event) => handleSecondFiles(event.target.files)}
              />
              <span className="text-xs text-gray-500">Soubory se uloží bez AI popisu.</span>
            </div>
            {secondUploadError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {secondUploadError}
              </div>
            )}
          </div>

          {secondLoading && (
            <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">Načítání...</div>
          )}

          {secondError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-600">{secondError}</div>
          )}

          {!secondLoading && !secondError && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {secondItems.map((item) => {
                const previewUrl = resolveMediaUrl(item.webp_path || undefined);
                return (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="mb-3 h-40 overflow-hidden rounded bg-gray-100">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={item.filename || "Media"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">
                          Bez náhledu
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="truncate font-medium text-gray-800">{item.filename || "—"}</div>
                      <div>Status: {item.status || "pending"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSecondAssign(item)}
                      className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-100"
                    >
                      Přiřadit do galerie
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!secondLoading && !secondError && secondItems.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              Žádné pending položky
            </div>
          )}
        </section>
      )}

      {aiAssignItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Přiřazení AI inbox položky</h3>
              <p className="text-xs text-gray-500">{aiAssignItem.filename || "—"}</p>
            </div>

            {productsError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {productsError}
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={aiCreateProduct}
                  onChange={(event) => setAiCreateProduct(event.target.checked)}
                />
                Vytvořit nový produkt z AI draftu
              </label>

              {!aiCreateProduct && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Vyber produkt</label>
                  <select
                    value={aiAssignProductId}
                    onChange={(event) => setAiAssignProductId(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={productsLoading}
                  >
                    <option value="">— vyberte —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (#{product.id})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Bez nového produktu se položka uloží jako varianta k vybranému produktu.
                  </p>
                </div>
              )}
            </div>

            {aiAssignError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {aiAssignError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAiAssign}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleAiAssign}
                disabled={aiAssignSubmitting || productsLoading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {aiAssignSubmitting ? "Ukládám..." : "Potvrdit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {secondAssignItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Přiřazení do galerie</h3>
              <p className="text-xs text-gray-500">{secondAssignItem.filename || "—"}</p>
            </div>

            {productsError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {productsError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Produkt</label>
                <select
                  value={secondAssignProductId}
                  onChange={(event) => {
                    setSecondAssignProductId(event.target.value);
                    setSecondAssignVariantId("");
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={productsLoading}
                >
                  <option value="">— vyberte —</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} (#{product.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Varianta</label>
                <select
                  value={secondAssignVariantId}
                  onChange={(event) => setSecondAssignVariantId(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={!secondAssignProductId || productsLoading}
                >
                  <option value="">— bez varianty —</option>
                  {secondVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {(variant.variant_name || "Varianta") + ` (#${variant.id})`}
                    </option>
                  ))}
                </select>
                {secondAssignProductId && secondVariants.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">Vybraný produkt nemá varianty.</p>
                )}
              </div>
            </div>

            {secondAssignError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {secondAssignError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeSecondAssign}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleSecondAssign}
                disabled={secondAssignSubmitting || productsLoading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {secondAssignSubmitting ? "Ukládám..." : "Potvrdit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
