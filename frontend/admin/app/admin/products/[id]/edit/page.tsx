"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AiDraft, Category, Product, ProductVariant } from "../../../../../lib/types";
import {
  analyzeImage,
  deleteMedia,
  deleteProduct,
  fetchAiProductDraft,
  fetchAiVariantDraft,
  fetchCategories,
  fetchProduct,
  generateDescription,
  ingestRag,
  searchRag,
  updateProduct,
} from "../../../../../lib/api";
import { resolveMediaUrl } from "../../../../../lib/media";

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
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerateLoading, setAiGenerateLoading] = useState(false);
  const [aiFullLoading, setAiFullLoading] = useState(false);
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [aiShortenLoading, setAiShortenLoading] = useState(false);
  const [aiToneLoading, setAiToneLoading] = useState(false);
  const [aiBulletsLoading, setAiBulletsLoading] = useState(false);
  const [aiPriceLoading, setAiPriceLoading] = useState(false);
  const [variantAiAction, setVariantAiAction] = useState<{ index: number; action: string } | null>(null);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [aiVariantDraft, setAiVariantDraft] = useState<{ index: number; draft: AiDraft } | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price_czk: "",
    stock: "",
    category_id: "",
    wrist_size: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
  });

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [deleteMainImage, setDeleteMainImage] = useState(false);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [clearVariants, setClearVariants] = useState(false);

  const mapVariantsFromProduct = (productData: Product): VariantForm[] =>
    (productData.variants || []).map((variant) => ({
      ...variant,
      imageFile: null,
      extraFiles: [],
      existingImage: variant.image || null,
      existingExtra: (variant.media || []).map((m) => m.image || "").filter(Boolean),
    }));

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
          seo_title: productData.seo_title || "",
          seo_description: productData.seo_description || "",
          seo_keywords: productData.seo_keywords || "",
        });
        setVariants(mapVariantsFromProduct(productData));
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

  const buildContext = (vision: Record<string, unknown>): string => {
    const labels = (vision.labels as string[]) || [];
    const objects = (vision.objects as string[]) || [];
    const colors =
      (vision.dominant_colors as string[]) ||
      (vision.dominantColors as string[]) ||
      (vision.colors as string[]) ||
      [];

    const lines = [
      labels.length ? `labels: ${labels.join(", ")}` : "",
      colors.length ? `dominant colors: ${colors.join(", ")}` : "",
      objects.length ? `objects: ${objects.join(", ")}` : "",
    ].filter(Boolean);

    return lines.join("\n");
  };

  const guessCategory = (labels: string[]): string => {
    if (!labels.length) return "";
    const lowered = labels.map((l) => l.toLowerCase());
    const match = categories.find((cat) => {
      const name = (cat.name || "").toLowerCase();
      const slug = (cat.slug || "").toLowerCase();
      return lowered.some((l) => name.includes(l) || slug.includes(l));
    });
    return match?.name || "";
  };

  const buildAiPrompt = (args: {
    visionText: string;
    productName?: string;
    ragExamples?: unknown;
  }): string => {
    const lines: string[] = [];
    lines.push("You are generating product data for a handmade shop.");
    lines.push("Return JSON only with keys: name, description, category_slug, price_czk, stock.");
    lines.push("Do not include extra keys or any commentary.");
    if (args.productName) {
      lines.push(`Product name hint: ${args.productName}`);
    }
    lines.push("Image attributes:");
    lines.push(args.visionText || "No attributes provided.");
    if (args.ragExamples) {
      lines.push("Similar examples (if any):");
      lines.push(JSON.stringify(args.ragExamples));
    }
    lines.push("Formatting rules:");
    lines.push("- description: single plain text, keep tone similar to existing products");
    lines.push("- category_slug: lowercase slug");
    lines.push("- price_czk: number");
    lines.push("- stock: integer");
    return lines.join("\n");
  };

  const buildVariantAiPrompt = (args: {
    visionText: string;
    variantName?: string;
    ragExamples?: unknown;
  }): string => {
    const lines: string[] = [];
    lines.push("You are generating product variant data for a handmade shop.");
    lines.push("Return JSON only with keys: variant_name, description, price_czk, stock.");
    lines.push("Do not include extra keys or any commentary.");
    if (args.variantName) {
      lines.push(`Variant name hint: ${args.variantName}`);
    }
    if (form.name) {
      lines.push(`Parent product: ${form.name}`);
    }
    lines.push("Image attributes:");
    lines.push(args.visionText || "No attributes provided.");
    if (args.ragExamples) {
      lines.push("Similar examples (if any):");
      lines.push(JSON.stringify(args.ragExamples));
    }
    lines.push("Formatting rules:");
    lines.push("- description: single plain text, keep tone similar to existing products");
    lines.push("- price_czk: number");
    lines.push("- stock: integer");
    return lines.join("\n");
  };

  const extractJson = (value: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(value);
    } catch {
      const start = value.indexOf("{");
      const end = value.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(value.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const buildRagPayload = (labels: string[], colors: string[], objects: string[], category: string) => ({
    category,
    attributes: { labels, colors, objects },
  });

  const callRag = async () => {
    const labels = [] as string[];
    const colors = [] as string[];
    const objects = [] as string[];
    const categoryName =
      categories.find((cat) => String(cat.id) === String(form.category_id))?.name || "";
    if (!categoryName) return null;
    try {
      return await searchRag(buildRagPayload(labels, colors, objects, categoryName));
    } catch (err) {
      console.error("RAG search failed:", err);
      return null;
    }
  };

  const extractText = (value: string) => {
    const parsed = extractJson(value);
    if (parsed && typeof parsed.description === "string") {
      return parsed.description;
    }
    return value;
  };

  const extractBullets = (value: string): string[] => {
    const parsed = extractJson(value);
    if (parsed && Array.isArray(parsed.bullets)) {
      return parsed.bullets.map((b) => String(b));
    }
    return value
      .split("\n")
      .map((line) => line.replace(/^[-•*\s]+/, "").trim())
      .filter(Boolean);
  };

  const extractPrice = (value: string): string => {
    const parsed = extractJson(value);
    if (parsed && parsed.price_czk !== undefined) {
      return String(parsed.price_czk);
    }
    const match = value.match(/([0-9]+(?:[.,][0-9]+)?)/);
    return match ? match[1].replace(",", ".") : "";
  };

  const fetchImageFile = async (
    file: File | null,
    fallbackPath: string | null,
    name: string,
    missingMessage = "Vyberte obrázek produktu."
  ): Promise<File> => {
    if (file) return file;
    if (!fallbackPath) {
      throw new Error(missingMessage);
    }
    const url = resolveMediaUrl(fallbackPath);
    if (!url) {
      throw new Error(missingMessage);
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Nepodařilo se načíst obrázek.");
    }
    const blob = await res.blob();
    const ext = blob.type?.split("/")[1] || "webp";
    return new File([blob], `${name}.${ext}`, { type: blob.type || "image/webp" });
  };

  const buildFormDataWithVariants = (variantList: VariantForm[]): FormData => {
    const data = new FormData();
    data.append("name", form.name);
    data.append("description", form.description);
    data.append("price_czk", form.price_czk);
    data.append("stock", form.stock);
    data.append("category_id", form.category_id);
    data.append("wrist_size", form.wrist_size);
    data.append("seo_title", form.seo_title);
    data.append("seo_description", form.seo_description);
    data.append("seo_keywords", form.seo_keywords);

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

    variantList.forEach((variant, index) => {
      data.append("variant_name[]", variant.variant_name || "");
      data.append("variant_wrist_size[]", variant.wrist_size || "");
      data.append("variant_stock[]", String(variant.stock ?? 0));
      data.append(
        "variant_price[]",
        variant.price_czk !== undefined && variant.price_czk !== null ? String(variant.price_czk) : ""
      );
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

  const buildFormData = (): FormData => buildFormDataWithVariants(variants);

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
      setForm((prev) => ({
        ...prev,
        seo_title: updated.seo_title || "",
        seo_description: updated.seo_description || "",
        seo_keywords: updated.seo_keywords || "",
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Uložení selhalo";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAiDraftProduct = async () => {
    if (!productId) return;
    setAiError(null);
    setAiLoading(true);
    try {
      const draft = await fetchAiProductDraft(productId);
      setAiDraft(draft);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI draft selhal";
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiDraftProduct = async () => {
    if (!aiDraft) return;
    setAiError(null);
    setSaving(true);
    try {
      const data = new FormData();
      if (aiDraft.title) data.append("name", aiDraft.title);
      if (aiDraft.description) data.append("description", aiDraft.description);
      if (aiDraft.suggested_price_czk !== undefined && aiDraft.suggested_price_czk !== null) {
        data.append("price_czk", String(aiDraft.suggested_price_czk));
      }
      if (aiDraft.seo_title) data.append("seo_title", aiDraft.seo_title);
      if (aiDraft.seo_description) data.append("seo_description", aiDraft.seo_description);
      if (aiDraft.seo_keywords) data.append("seo_keywords", aiDraft.seo_keywords);
      const updated = await updateProduct(productId, data);
      setProduct(updated);
      setForm((prev) => ({
        ...prev,
        name: updated.name || prev.name,
        description: updated.description || prev.description,
        price_czk:
          updated.price !== undefined && updated.price !== null ? String(updated.price) : prev.price_czk,
        seo_title: updated.seo_title || "",
        seo_description: updated.seo_description || "",
        seo_keywords: updated.seo_keywords || "",
      }));
      setAiDraft(null);
      setSuccess("AI návrh byl použit.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Uložení AI návrhu selhalo";
      setAiError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    setAiError(null);
    setAiGenerateLoading(true);
    try {
      const imageFile = await fetchImageFile(
        mainImageFile,
        product?.image_url || product?.image || null,
        "product-image"
      );
      const visionForm = new FormData();
      visionForm.append("image", imageFile);
      const visionResult = await analyzeImage(visionForm);
      const context = buildContext(visionResult as Record<string, unknown>);
      const generated = await generateDescription(context);

      const description =
        generated.long_description ||
        generated.description ||
        generated.text ||
        generated.short_description ||
        "";

      if (!description) {
        throw new Error("AI nevygenerovala popis.");
      }

      setForm((prev) => ({ ...prev, description }));

      const labels = (visionResult.labels as string[]) || [];
      const objects = (visionResult.objects as string[]) || [];
      const colors =
        (visionResult.dominant_colors as string[]) ||
        (visionResult.dominantColors as string[]) ||
        (visionResult.colors as string[]) ||
        [];
      const categoryName =
        categories.find((cat) => String(cat.id) === String(form.category_id))?.name || "";

      void ingestRag({
        category: categoryName,
        attributes: {
          labels,
          colors,
          objects,
        },
        description,
      }).catch((err) => {
        console.error("RAG ingest failed:", err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiGenerateLoading(false);
    }
  };

  const handleCreateWithAi = async () => {
    setAiError(null);
    setAiFullLoading(true);
    try {
      const imageFile = await fetchImageFile(
        mainImageFile,
        product?.image_url || product?.image || null,
        "product-image"
      );
      const visionForm = new FormData();
      visionForm.append("image", imageFile);
      const visionResult = await analyzeImage(visionForm);

      const labels = (visionResult.labels as string[]) || [];
      const objects = (visionResult.objects as string[]) || [];
      const colors =
        (visionResult.dominant_colors as string[]) ||
        (visionResult.dominantColors as string[]) ||
        (visionResult.colors as string[]) ||
        [];

      const categoryGuess = guessCategory(labels);

      let ragExamples: unknown = null;
      try {
        ragExamples = await searchRag({
          category: categoryGuess,
          attributes: { labels, colors, objects },
        });
      } catch (err) {
        console.error("RAG search failed:", err);
      }

      const visionText = buildContext({
        labels,
        colors,
        dominant_colors: colors,
        objects,
      });

      const prompt = buildAiPrompt({
        visionText,
        productName: form.name || undefined,
        ragExamples,
      });

      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";

      const parsed = extractJson(raw);
      if (!parsed) {
        throw new Error("AI nevrátila platný JSON.");
      }

      const nextName = (parsed.name as string) || form.name || "";
      const nextDescription = (parsed.description as string) || form.description || "";
      const nextPrice = parsed.price_czk !== undefined ? String(parsed.price_czk) : form.price_czk;
      const nextStock = parsed.stock !== undefined ? String(parsed.stock) : form.stock;
      const categorySlug = (parsed.category_slug as string) || "";
      const categoryId =
        categories.find((cat) => String(cat.slug) === String(categorySlug))?.id ||
        categories.find((cat) => String(cat.name) === String(categoryGuess))?.id ||
        "";

      setForm((prev) => ({
        ...prev,
        name: nextName,
        description: nextDescription,
        price_czk: nextPrice,
        stock: nextStock,
        category_id: categoryId ? String(categoryId) : prev.category_id,
      }));

      const categoryName =
        categories.find((cat) => String(cat.id) === String(categoryId))?.name || categoryGuess || "";

      void ingestRag({
        category: categoryName,
        attributes: { labels, colors, objects },
        description: nextDescription,
      }).catch((err) => {
        console.error("RAG ingest failed:", err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiFullLoading(false);
    }
  };

  const handleRewriteDescription = async () => {
    if (!form.description.trim()) {
      setAiError("Nejprve vyplňte popis.");
      return;
    }
    setAiError(null);
    setAiRewriteLoading(true);
    try {
      const categoryName =
        categories.find((cat) => String(cat.id) === String(form.category_id))?.name || "";
      const ragExamples = await callRag();
      const prompt = [
        "Rewrite the product description in Czech.",
        "Keep the same meaning and structure but improve clarity.",
        `Name: ${form.name}`,
        categoryName ? `Category: ${categoryName}` : "",
        ragExamples ? `Examples: ${JSON.stringify(ragExamples)}` : "",
        "Return plain text only.",
        `Current description: ${form.description}`,
      ]
        .filter(Boolean)
        .join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractText(raw);
      if (!next) throw new Error("AI nevrátila text.");
      setForm((prev) => ({ ...prev, description: next }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiRewriteLoading(false);
    }
  };

  const handleShortenDescription = async () => {
    if (!form.description.trim()) {
      setAiError("Nejprve vyplňte popis.");
      return;
    }
    setAiError(null);
    setAiShortenLoading(true);
    try {
      const prompt = [
        "Shorten the following Czech product description into a shorter marketing version.",
        "Return plain text only.",
        form.description,
      ].join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractText(raw);
      if (!next) throw new Error("AI nevrátila text.");
      setForm((prev) => ({ ...prev, description: next }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiShortenLoading(false);
    }
  };

  const handleImproveTone = async () => {
    if (!form.description.trim()) {
      setAiError("Nejprve vyplňte popis.");
      return;
    }
    setAiError(null);
    setAiToneLoading(true);
    try {
      const prompt = [
        "Vylepšit marketingový tón of the Czech product description.",
        "More emotional and benefit-oriented, no emojis.",
        "Return plain text only.",
        form.description,
      ].join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractText(raw);
      if (!next) throw new Error("AI nevrátila text.");
      setForm((prev) => ({ ...prev, description: next }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiToneLoading(false);
    }
  };

  const handleGenerateBullets = async () => {
    if (!form.description.trim()) {
      setAiError("Nejprve vyplňte popis.");
      return;
    }
    setAiError(null);
    setAiBulletsLoading(true);
    try {
      const prompt = [
        "Generate 3-6 bullet highlights in Czech based on the description.",
        "Return bullet points only, each on a new line.",
        form.description,
      ].join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const bullets = extractBullets(raw);
      if (!bullets.length) throw new Error("AI nevrátila body.");
      const bulletText = bullets.map((b) => `• ${b}`).join("\n");
      setForm((prev) => ({ ...prev, description: `${prev.description}\n\n${bulletText}`.trim() }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiBulletsLoading(false);
    }
  };

  const handleSuggestPrice = async () => {
    setAiError(null);
    setAiPriceLoading(true);
    try {
      const categoryName =
        categories.find((cat) => String(cat.id) === String(form.category_id))?.name || "";
      const ragExamples = await callRag();
      const prompt = [
        "Suggest a CZK price as a number for this product.",
        "Return only the numeric price.",
        `Name: ${form.name}`,
        categoryName ? `Category: ${categoryName}` : "",
        ragExamples ? `Examples: ${JSON.stringify(ragExamples)}` : "",
        `Description: ${form.description}`,
      ]
        .filter(Boolean)
        .join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractPrice(raw);
      if (!next) throw new Error("AI nevrátila cenu.");
      setForm((prev) => ({ ...prev, price_czk: next }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiPriceLoading(false);
    }
  };

  const isVariantBusy = (index: number, action?: string) =>
    !!variantAiAction &&
    variantAiAction.index === index &&
    (!action || variantAiAction.action === action);

  const handleVariantGenerateDescription = async (index: number) => {
    const variant = variants[index];
    if (!variant) return;
    setAiError(null);
    setVariantAiAction({ index, action: "generate" });
    try {
      const imageFile = await fetchImageFile(
        variant.imageFile || null,
        variant.existingImage || variant.image || null,
        "variant-image",
        "Vyberte obrázek varianty."
      );
      const visionForm = new FormData();
      visionForm.append("image", imageFile);
      const visionResult = await analyzeImage(visionForm);
      const context = buildContext(visionResult as Record<string, unknown>);
      const generated = await generateDescription(context);
      const description =
        generated.long_description ||
        generated.description ||
        generated.text ||
        generated.short_description ||
        "";
      if (!description) {
        throw new Error("AI nevygenerovala popis.");
      }
      updateVariant(index, { description });

      const labels = (visionResult.labels as string[]) || [];
      const objects = (visionResult.objects as string[]) || [];
      const colors =
        (visionResult.dominant_colors as string[]) ||
        (visionResult.dominantColors as string[]) ||
        (visionResult.colors as string[]) ||
        [];
      const categoryName =
        categories.find((cat) => String(cat.id) === String(form.category_id))?.name || "";

      void ingestRag({
        category: categoryName,
        attributes: { labels, colors, objects },
        description,
      }).catch((err) => {
        console.error("RAG ingest failed:", err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setVariantAiAction(null);
    }
  };

  const handleVariantCreateWithAi = async (index: number) => {
    const variant = variants[index];
    if (!variant) return;
    setAiError(null);
    setVariantAiAction({ index, action: "full" });
    try {
      const imageFile = await fetchImageFile(
        variant.imageFile || null,
        variant.existingImage || variant.image || null,
        "variant-image",
        "Vyberte obrázek varianty."
      );
      const visionForm = new FormData();
      visionForm.append("image", imageFile);
      const visionResult = await analyzeImage(visionForm);

      const labels = (visionResult.labels as string[]) || [];
      const objects = (visionResult.objects as string[]) || [];
      const colors =
        (visionResult.dominant_colors as string[]) ||
        (visionResult.dominantColors as string[]) ||
        (visionResult.colors as string[]) ||
        [];
      const categoryGuess = guessCategory(labels);

      let ragExamples: unknown = null;
      try {
        ragExamples = await searchRag({
          category: categoryGuess,
          attributes: { labels, colors, objects },
        });
      } catch (err) {
        console.error("RAG search failed:", err);
      }

      const visionText = buildContext({
        labels,
        colors,
        dominant_colors: colors,
        objects,
      });

      const prompt = buildVariantAiPrompt({
        visionText,
        variantName: variant.variant_name || undefined,
        ragExamples,
      });

      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";

      const parsed = extractJson(raw);
      if (!parsed) {
        throw new Error("AI nevrátila platný JSON.");
      }

      const nextName =
        (parsed.variant_name as string) ||
        (parsed.name as string) ||
        variant.variant_name ||
        "";
      const nextDescription = (parsed.description as string) || variant.description || "";
      const nextPrice =
        parsed.price_czk !== undefined && parsed.price_czk !== null
          ? Number(parsed.price_czk)
          : variant.price_czk;
      const nextStock =
        parsed.stock !== undefined && parsed.stock !== null ? Number(parsed.stock) : variant.stock;

      updateVariant(index, {
        variant_name: nextName,
        description: nextDescription,
        price_czk: Number.isNaN(nextPrice) ? variant.price_czk : nextPrice,
        stock: Number.isNaN(nextStock) ? variant.stock : nextStock,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setVariantAiAction(null);
    }
  };

  const handleVariantRewriteDescription = async (index: number) => {
    const variant = variants[index];
    if (!variant?.description?.trim()) {
      setAiError("Nejprve vyplňte popis varianty.");
      return;
    }
    setAiError(null);
    setVariantAiAction({ index, action: "rewrite" });
    try {
      const categoryName =
        categories.find((cat) => String(cat.id) === String(form.category_id))?.name || "";
      const ragExamples = await callRag();
      const prompt = [
        "Rewrite the variant description in Czech.",
        "Keep the same meaning and structure but improve clarity.",
        `Variant name: ${variant.variant_name || ""}`,
        form.name ? `Parent product: ${form.name}` : "",
        categoryName ? `Category: ${categoryName}` : "",
        ragExamples ? `Examples: ${JSON.stringify(ragExamples)}` : "",
        "Return plain text only.",
        `Current description: ${variant.description}`,
      ]
        .filter(Boolean)
        .join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractText(raw);
      if (!next) throw new Error("AI nevrátila text.");
      updateVariant(index, { description: next });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setVariantAiAction(null);
    }
  };

  const handleVariantShortenDescription = async (index: number) => {
    const variant = variants[index];
    if (!variant?.description?.trim()) {
      setAiError("Nejprve vyplňte popis varianty.");
      return;
    }
    setAiError(null);
    setVariantAiAction({ index, action: "shorten" });
    try {
      const prompt = [
        "Shorten the following Czech variant description into a shorter marketing version.",
        "Return plain text only.",
        variant.description,
      ].join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractText(raw);
      if (!next) throw new Error("AI nevrátila text.");
      updateVariant(index, { description: next });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setVariantAiAction(null);
    }
  };

  const handleVariantImproveTone = async (index: number) => {
    const variant = variants[index];
    if (!variant?.description?.trim()) {
      setAiError("Nejprve vyplňte popis varianty.");
      return;
    }
    setAiError(null);
    setVariantAiAction({ index, action: "tone" });
    try {
      const prompt = [
        "Vylepšit marketingový tón of the Czech variant description.",
        "More emotional and benefit-oriented, no emojis.",
        "Return plain text only.",
        variant.description,
      ].join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractText(raw);
      if (!next) throw new Error("AI nevrátila text.");
      updateVariant(index, { description: next });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setVariantAiAction(null);
    }
  };

  const handleVariantGenerateBullets = async (index: number) => {
    const variant = variants[index];
    if (!variant?.description?.trim()) {
      setAiError("Nejprve vyplňte popis varianty.");
      return;
    }
    setAiError(null);
    setVariantAiAction({ index, action: "bullets" });
    try {
      const prompt = [
        "Generate 3-6 bullet highlights in Czech based on the description.",
        "Return bullet points only, each on a new line.",
        variant.description,
      ].join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const bullets = extractBullets(raw);
      if (!bullets.length) throw new Error("AI nevrátila body.");
      const bulletText = bullets.map((b) => `• ${b}`).join("\n");
      updateVariant(index, {
        description: `${variant.description}\n\n${bulletText}`.trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setVariantAiAction(null);
    }
  };

  const handleVariantSuggestPrice = async (index: number) => {
    const variant = variants[index];
    if (!variant) return;
    setAiError(null);
    setVariantAiAction({ index, action: "price" });
    try {
      const categoryName =
        categories.find((cat) => String(cat.id) === String(form.category_id))?.name || "";
      const ragExamples = await callRag();
      const prompt = [
        "Suggest a CZK price as a number for this variant.",
        "Return only the numeric price.",
        `Variant name: ${variant.variant_name || ""}`,
        form.name ? `Parent product: ${form.name}` : "",
        categoryName ? `Category: ${categoryName}` : "",
        ragExamples ? `Examples: ${JSON.stringify(ragExamples)}` : "",
        `Description: ${variant.description || ""}`,
      ]
        .filter(Boolean)
        .join("\n");
      const generated = await generateDescription(prompt);
      const raw =
        generated.text ||
        generated.description ||
        generated.long_description ||
        generated.short_description ||
        "";
      const next = extractPrice(raw);
      if (!next) throw new Error("AI nevrátila cenu.");
      updateVariant(index, {
        price_czk: Number(next),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setVariantAiAction(null);
    }
  };

  const handleAiDraftVariant = async (index: number) => {
    const variant = variants[index];
    if (!variant?.id) {
      setAiError("Varianta musí být nejdřív uložená.");
      return;
    }
    setAiError(null);
    setAiLoading(true);
    try {
      const draft = await fetchAiVariantDraft(variant.id);
      setAiVariantDraft({ index, draft });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI draft selhal";
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiDraftVariant = async () => {
    if (!aiVariantDraft) return;
    setAiError(null);
    setSaving(true);
    try {
      const { index, draft } = aiVariantDraft;
      const nextVariants = variants.map((variant, idx) => {
        if (idx !== index) return variant;
        return {
          ...variant,
          variant_name: draft.title || variant.variant_name,
          description: draft.description || variant.description,
          price_czk:
            draft.suggested_variant_price_czk !== undefined && draft.suggested_variant_price_czk !== null
              ? draft.suggested_variant_price_czk
              : variant.price_czk,
        };
      });
      const data = buildFormDataWithVariants(nextVariants);
      const updated = await updateProduct(productId, data);
      setProduct(updated);
      setVariants(mapVariantsFromProduct(updated));
      setAiVariantDraft(null);
      setSuccess("AI návrh varianty byl použit.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Uložení AI návrhu selhalo";
      setAiError(message);
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

        {aiError && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {aiError}
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={aiGenerateLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiGenerateLoading ? "Generuji..." : "Vygenerovat popis z obrázku (AI)"}
                </button>
                <button
                  type="button"
                  onClick={handleCreateWithAi}
                  disabled={aiFullLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiFullLoading ? "Generuji..." : "Vytvořit produkt pomocí AI"}
                </button>
                <button
                  type="button"
                  onClick={handleRewriteDescription}
                  disabled={aiRewriteLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiRewriteLoading ? "Generuji..." : "Přepsat popis (AI)"}
                </button>
                <button
                  type="button"
                  onClick={handleShortenDescription}
                  disabled={aiShortenLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiShortenLoading ? "Generuji..." : "Zkrátit popis"}
                </button>
                <button
                  type="button"
                  onClick={handleImproveTone}
                  disabled={aiToneLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiToneLoading ? "Generuji..." : "Vylepšit marketingový tón"}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateBullets}
                  disabled={aiBulletsLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiBulletsLoading ? "Generuji..." : "Vygenerovat body výhod"}
                </button>
              </div>
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
                <button
                  type="button"
                  onClick={handleSuggestPrice}
                  disabled={aiPriceLoading}
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiPriceLoading ? "Generuji..." : "Navrhnout lepší cenu"}
                </button>
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
                    src={resolveMediaUrl(product.image_url) || undefined}
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
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleAiDraftProduct}
                  disabled={aiLoading}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs"
                >
                  {aiLoading ? "Generuji..." : "Upravit pomocí AI"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">Další média</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {(product.media_items || []).map((media) => (
                <div key={media.id} className="flex flex-col items-center gap-2">
                  <div className="h-20 w-20 overflow-hidden rounded-lg bg-gray-100 shadow">
                    {media.media_type?.startsWith("video") ? (
                      <video src={resolveMediaUrl(media.url) || undefined} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={resolveMediaUrl(media.url) || undefined} alt="media" className="h-full w-full object-cover" />
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

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleVariantGenerateDescription(index)}
                    disabled={isVariantBusy(index, "generate")}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {isVariantBusy(index, "generate") ? "Generuji..." : "Vygenerovat popis z obrázku (AI)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVariantCreateWithAi(index)}
                    disabled={isVariantBusy(index, "full")}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {isVariantBusy(index, "full") ? "Generuji..." : "Vytvořit variantu pomocí AI"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVariantRewriteDescription(index)}
                    disabled={isVariantBusy(index, "rewrite")}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {isVariantBusy(index, "rewrite") ? "Generuji..." : "Přepsat popis (AI)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVariantShortenDescription(index)}
                    disabled={isVariantBusy(index, "shorten")}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {isVariantBusy(index, "shorten") ? "Generuji..." : "Zkrátit popis"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVariantImproveTone(index)}
                    disabled={isVariantBusy(index, "tone")}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {isVariantBusy(index, "tone") ? "Generuji..." : "Vylepšit marketingový tón"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVariantGenerateBullets(index)}
                    disabled={isVariantBusy(index, "bullets")}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {isVariantBusy(index, "bullets") ? "Generuji..." : "Vygenerovat body výhod"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVariantSuggestPrice(index)}
                    disabled={isVariantBusy(index, "price")}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {isVariantBusy(index, "price") ? "Generuji..." : "Navrhnout lepší cenu"}
                  </button>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Obrázek varianty</label>
                  {variant.existingImage && (
                      <div className="mb-2 flex items-center gap-3">
                        <div className="h-16 w-16 overflow-hidden rounded shadow">
                          <img src={resolveMediaUrl(variant.existingImage) || undefined} alt="variant" className="h-full w-full object-cover" />
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
                            <img src={resolveMediaUrl(filename) || undefined} alt="extra" className="h-full w-full object-cover" />
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
                    {variant.id && (
                      <button
                        type="button"
                        onClick={() => handleAiDraftVariant(index)}
                        className="ml-2 rounded-md border border-gray-300 px-3 py-1 text-xs"
                      >
                        Upravit pomocí AI
                      </button>
                    )}
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

        {aiDraft && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
              <h4 className="text-lg font-semibold">AI návrh produktu</h4>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">Název</div>
                  <div className="rounded border border-gray-200 p-2">{aiDraft.title || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">Popis</div>
                  <div className="rounded border border-gray-200 p-2 whitespace-pre-line">
                    {aiDraft.description || "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">Cena (návrh)</div>
                    <div className="rounded border border-gray-200 p-2">
                      {aiDraft.suggested_price_czk ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">Typ</div>
                    <div className="rounded border border-gray-200 p-2">{aiDraft.product_type || "—"}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAiDraft(null)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  onClick={applyAiDraftProduct}
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Použít
                </button>
              </div>
            </div>
          </div>
        )}

        {aiVariantDraft && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
              <h4 className="text-lg font-semibold">AI návrh varianty</h4>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">Název</div>
                  <div className="rounded border border-gray-200 p-2">{aiVariantDraft.draft.title || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-500">Popis</div>
                  <div className="rounded border border-gray-200 p-2 whitespace-pre-line">
                    {aiVariantDraft.draft.description || "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">Cena (návrh)</div>
                    <div className="rounded border border-gray-200 p-2">
                      {aiVariantDraft.draft.suggested_variant_price_czk ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">Typ</div>
                    <div className="rounded border border-gray-200 p-2">{aiVariantDraft.draft.product_type || "—"}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAiVariantDraft(null)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  onClick={applyAiDraftVariant}
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Použít
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

