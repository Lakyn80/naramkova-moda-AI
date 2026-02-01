"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Category, Product, ProductVariant } from "../../../../../lib/types";
import {
  deleteMedia,
  deleteProduct,
  fetchCategories,
  fetchProduct,
  updateProduct,
  STATIC_BASE,
} from "../../../../../lib/api";

type VariantForm = ProductVariant & {
  imageFile?: File | null;
  extraFiles?: File[];
  existingImage?: string | null;
  existingExtra?: string[];
};

function formatPrice(value?: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function fileFromNothing() {
  return new Blob([]);
}

export default function AdminProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price_czk: "",
    stock: "",
    category_id: "",
    wrist_size: "",
  });

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [deleteMainImage, setDeleteMainImage] = useState(false);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [clearVariants, setClearVariants] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchProduct(productId), fetchCategories()])
      .then(([productData, categoriesData]) => {
        if (!active) return;
        setProduct(productData);
        setCategories(categoriesData);
        setForm({
          name: productData.name || "",
          description: productData.description || "",
          price_czk: formatPrice(productData.price),
          stock: productData.stock !== undefined && productData.stock !== null ? String(productData.stock) : "",
          category_id: productData.category_id ? String(productData.category_id) : "",
          wrist_size: productData.wrist_size || "",
        });
        const mappedVariants = (productData.variants || []).map((variant) => ({
          ...variant,
          imageFile: null,
          extraFiles: [],
          existingImage: variant.image || null,
          existingExtra: (variant.media || []).map((m) => m.image || "").filter(Boolean),
        }));
        setVariants(mappedVariants);
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
  }, [productId]);

  useEffect(() => {
    if (!mainImageFile) {
      setMainPreview(null);
      return;
    }
    const url = URL.createObjectURL(mainImageFile);
    setMainPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [mainImageFile]);

  const categoryOptions = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        label: `${cat.group || "—"} — ${cat.name}`,
      })),
    [categories]
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        variant_name: "",
        wrist_size: "",
        description: "",
        price_czk: null,
        stock: 0,
        image: null,
        image_url: null,
        media: [],
        imageFile: null,
        extraFiles: [],
        existingImage: null,
        existingExtra: [],
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx != index));
  };

  const handleClearVariants = () => {
    setVariants([]);
    setClearVariants(true);
  };

  const updateVariant = (index: number, patch: Partial<VariantForm>) => {
    setVariants((prev) => prev.map((variant, idx) => (idx === index ? { ...variant, ...patch } : variant)));
  };

  const handleDeleteProduct = async () => {
    const ok = window.confirm("Opravdu smazat tento produkt?");
    if (!ok) return;
    setError(null);
    try {
      await deleteProduct(productId);
      router.push("/admin/products");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Smazání selhalo";
      setError(message);
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    const ok = window.confirm("Smazat toto médium?");
    if (!ok) return;
    setError(null);
    try {
      await deleteMedia(mediaId);
      setProduct((prev) => {
        if (!prev) return prev;
        const nextItems = (prev.media_items || []).filter((item) => item.id !== mediaId);
        return { ...prev, media_items: nextItems };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Smazání selhalo";
      setError(message);
    }
  };

  const buildFormData = (): FormData => {
    const data = new FormData();
    data.append("name", form.name);
    data.append("description", form.description);
    data.append("price_czk", form.price_czk);
    data.append("stock", form.stock);
    data.append("category_id", form.category_id);
    data.append("wrist_size", form.wrist_size);

    if (deleteMainImage) {
      data.append("delete_image", "1");
    }

    if (mainImageFile) {
      data.append("image", mainImageFile);
    }

    if (mediaFiles.length) {
      mediaFiles.forEach((file) => data.append("media", file));
    }

    if (clearVariants) {
      data.append("clear_variants", "1");
    }

    variants.forEach((variant, index) => {
      data.append("variant_name[]", variant.variant_name || "");
      data.append("variant_wrist_size[]", variant.wrist_size || "");
      data.append("variant_stock[]", String(variant.stock ?? 0));
      data.append("variant_price[]", variant.price_czk !== undefined && variant.price_czk !== null ? String(variant.price_czk) : "");
      data.append("variant_description[]", variant.description || "");

      const existingImage = variant.existingImage || "";
      data.append("variant_image_existing[]", existingImage);

      if (variant.imageFile) {
        data.append("variant_image[]", variant.imageFile);
      } else {
        data.append("variant_image[]", fileFromNothing(), "");
      }

      (variant.existingExtra || []).forEach((filename) => {
        data.append(`variant_image_existing_multi_${index}[]`, filename);
      });

      (variant.extraFiles || []).forEach((file) => {
        data.append(`variant_image_multi_${index}[]`, file);
      });
    });

    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const data = buildFormData();
      const updated = await updateProduct(productId, data);
      setProduct(updated);
      setSuccess("Produkt byl uložen.");
      setClearVariants(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Uložení selhalo";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Načítání...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Produkt nenalezen.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">✏️ Upravit produkt</h1>
            <p className="text-sm text-gray-500">ID #{product.id}</p>
          </div>
          <Link href="/admin/products" className="text-sm text-gray-600 underline">
            Zpět na seznam
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Název</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Kategorie</label>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— Vyber kategorii —</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Popis</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Cena (Kč)</label>
                <input
                  type="number"
                  name="price_czk"
                  value={form.price_czk}
                  onChange={handleChange}
                  step="0.01"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sklad</label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Obvod / velikost</label>
                <input
                  type="text"
                  name="wrist_size"
                  value={form.wrist_size}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">Úvodní obrázek</h2>
            {product.image_url && !deleteMainImage && (
              <div className="mt-3 flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-lg shadow">
                  <img
                    src={`${STATIC_BASE}${product.image_url}`}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteMainImage(true)}
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700"
                >
                  🗑️ Smazat úvodní fotku
                </button>
              </div>
            )}
            {deleteMainImage && (
              <div className="mt-3 text-xs text-red-600">
                Úvodní obrázek bude po uložení smazán.
              </div>
            )}
            <div className="mt-4">
              <input type="file" accept="image/*" onChange={(e) => setMainImageFile(e.target.files?.[0] || null)} />
              {mainPreview && (
                <div className="mt-3 h-20 w-20 overflow-hidden rounded-lg shadow">
                  <img src={mainPreview} alt="preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">Další média</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {(product.media_items || []).map((media) => (
                <div key={media.id} className="flex flex-col items-center gap-2">
                  <div className="h-20 w-20 overflow-hidden rounded-lg bg-gray-100 shadow">
                    {media.media_type?.startsWith("video") ? (
                      <video src={`${STATIC_BASE}${media.url}`} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={`${STATIC_BASE}${media.url}`} alt="media" className="h-full w-full object-cover" />
                    )}
                  </div>
                  {media.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(media.id!)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700"
                    >
                      Smazat
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setMediaFiles(Array.from(e.target.files || []))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-700">Varianty</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs"
                >
                  + Přidat variantu
                </button>
                <button
                  type="button"
                  onClick={handleClearVariants}
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700"
                >
                  Vymazat všechny varianty
                </button>
              </div>
            </div>

            {variants.length === 0 && (
              <div className="mt-4 text-sm text-gray-500">Žádné varianty.</div>
            )}

            <div className="mt-4 space-y-4">
              {variants.map((variant, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Název</label>
                      <input
                        type="text"
                        value={variant.variant_name || ""}
                        onChange={(e) => updateVariant(index, { variant_name: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Obvod</label>
                      <input
                        type="text"
                        value={variant.wrist_size || ""}
                        onChange={(e) => updateVariant(index, { wrist_size: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Cena</label>
                      <input
                        type="number"
                        step="0.01"
                        value={variant.price_czk ?? ""}
                        onChange={(e) => updateVariant(index, { price_czk: e.target.value ? Number(e.target.value) : null })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Sklad</label>
                      <input
                        type="number"
                        value={variant.stock ?? 0}
                        onChange={(e) => updateVariant(index, { stock: Number(e.target.value) })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Popis</label>
                      <textarea
                        value={variant.description || ""}
                        onChange={(e) => updateVariant(index, { description: e.target.value })}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Obrázek varianty</label>
                    {variant.existingImage && (
                      <div className="mb-2 flex items-center gap-3">
                        <div className="h-16 w-16 overflow-hidden rounded shadow">
                          <img src={`${STATIC_BASE}/static/uploads/${variant.existingImage}`} alt="variant" className="h-full w-full object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={() => updateVariant(index, { existingImage: "" })}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700"
                        >
                          Smazat
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => updateVariant(index, { imageFile: e.target.files?.[0] || null })}
                    />
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Další fotky</label>
                    <div className="mb-2 flex flex-wrap gap-2">
                      {(variant.existingExtra || []).map((filename) => (
                        <div key={filename} className="flex flex-col items-center">
                          <div className="h-14 w-14 overflow-hidden rounded bg-gray-100">
                            <img src={`${STATIC_BASE}/static/uploads/${filename}`} alt="extra" className="h-full w-full object-cover" />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateVariant(index, {
                                existingExtra: (variant.existingExtra || []).filter((item) => item !== filename),
                              })
                            }
                            className="mt-1 text-xs text-red-600"
                          >
                            odebrat
                          </button>
                        </div>
                      ))}
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => updateVariant(index, { extraFiles: Array.from(e.target.files || []) })}
                    />
                  </div>

                  <div className="mt-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(index)}
                      className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700"
                    >
                      Odstranit variantu
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Ukládám..." : "Uložit"}
            </button>
            <button
              type="button"
              onClick={handleDeleteProduct}
              className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-700"
            >
              🗑️ Smazat produkt
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

