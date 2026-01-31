"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "../../../../lib/types";
import {
  analyzeImage,
  createProduct,
  fetchCategories,
  generateDescription,
  ingestRag,
  searchRag,
} from "../../../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function AdminProductNewPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFullLoading, setAiFullLoading] = useState(false);
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [aiShortenLoading, setAiShortenLoading] = useState(false);
  const [aiToneLoading, setAiToneLoading] = useState(false);
  const [aiBulletsLoading, setAiBulletsLoading] = useState(false);
  const [aiPriceLoading, setAiPriceLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price_czk: "",
    stock: "",
    category_id: "",
    image: null as File | null,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCategories()
      .then((data) => {
        if (!active) return;
        setCategories(data);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message || "Failed to load categories");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, image: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("description", form.description);
      data.append("price_czk", form.price_czk);
      data.append("stock", form.stock);
      data.append("category_id", form.category_id);
      if (form.image) {
        data.append("image", form.image);
      }

      await createProduct(data);
      setSuccess("Produkt byl vytvořen.");
      router.push("/admin/products?created=1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create product";
      setError(message);
    } finally {
      setSubmitting(false);
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

  const handleGenerateDescription = async () => {
    if (!form.image) {
      setAiError("Vyberte obrázek produktu.");
      return;
    }

    setAiError(null);
    setAiLoading(true);

    try {
      const visionForm = new FormData();
      visionForm.append("image", form.image);
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
      setAiLoading(false);
    }
  };

  const handleCreateWithAi = async () => {
    if (!form.image) {
      setAiError("Vyberte obrázek produktu.");
      return;
    }

    setAiError(null);
    setAiFullLoading(true);

    try {
      const visionForm = new FormData();
      visionForm.append("image", form.image);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generování selhalo.";
      setAiError(message);
    } finally {
      setAiFullLoading(false);
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
      .map((line) => line.replace(/^[-•*\\s]+/, "").trim())
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
        "Improve marketing tone of the Czech product description.",
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
        form.description ? `Description: ${form.description}` : "",
        ragExamples ? `Examples: ${JSON.stringify(ragExamples)}` : "",
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

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Nový produkt</h1>
          <p className="text-sm text-gray-500">Vytvoření produktu v administraci.</p>
        </div>

        {loading && (
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Načítání kategorií...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {aiError && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {aiError}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
              <label className="mb-1 block text-sm font-medium">Popis</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiLoading ? "Generuji..." : "Generate description from image (AI)"}
                </button>
                <button
                  type="button"
                  onClick={handleCreateWithAi}
                  disabled={aiFullLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiFullLoading ? "Generuji..." : "Create product with AI"}
                </button>
                <button
                  type="button"
                  onClick={handleRewriteDescription}
                  disabled={aiRewriteLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiRewriteLoading ? "Generuji..." : "Rewrite description (AI)"}
                </button>
                <button
                  type="button"
                  onClick={handleShortenDescription}
                  disabled={aiShortenLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiShortenLoading ? "Generuji..." : "Shorten description"}
                </button>
                <button
                  type="button"
                  onClick={handleImproveTone}
                  disabled={aiToneLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiToneLoading ? "Generuji..." : "Improve marketing tone"}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateBullets}
                  disabled={aiBulletsLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  {aiBulletsLoading ? "Generuji..." : "Generate bullet highlights"}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Cena (CZK)</label>
                <input
                  type="number"
                  name="price_czk"
                  value={form.price_czk}
                  onChange={handleChange}
                  step="0.01"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleSuggestPrice}
                    disabled={aiPriceLoading}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                  >
                    {aiPriceLoading ? "Generuji..." : "Suggest better price"}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sklad</label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Kategorie</label>
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Vyberte kategorii</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Obrázek</label>
              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={handleFileChange}
                required
                className="w-full text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Upload: {API_BASE ? `${API_BASE}/static/uploads/` : "/static/uploads/"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {submitting ? "Ukládám..." : "Vytvořit produkt"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/products")}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Zpět
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
