"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { buildApiUrl, fetchProducts } from "../../../lib/api";
import { resolveMediaUrl } from "../../../lib/media";
import type { Product } from "../../../lib/types";

type AiInboxItem = {
  id: number;
  filename?: string | null;
  webp_path: string;
  product_type?: string | null;
  status?: string | null;
};

type SecondInboxItem = {
  id: number;
  filename?: string | null;
  webp_path: string;
  product_type?: string | null;
  status?: string | null;
};

function normalizeError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export default function MediaInboxPage() {
  const [aiItems, setAiItems] = useState<AiInboxItem[]>([]);
  const [secondItems, setSecondItems] = useState<SecondInboxItem[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingSecond, setLoadingSecond] = useState(false);
  const [errorAi, setErrorAi] = useState<string | null>(null);
  const [errorSecond, setErrorSecond] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());
  const [secondSelected, setSecondSelected] = useState<Set<number>>(new Set());

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [showAiVariantModal, setShowAiVariantModal] = useState(false);
  const [showSecondProductModal, setShowSecondProductModal] = useState(false);
  const [showSecondVariantModal, setShowSecondVariantModal] = useState(false);
  const [showAiDeleteAllModal, setShowAiDeleteAllModal] = useState(false);
  const [showSecondDeleteAllModal, setShowSecondDeleteAllModal] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");

  const [busyAi, setBusyAi] = useState(false);
  const [busySecond, setBusySecond] = useState(false);
  const [aiActionError, setAiActionError] = useState<string | null>(null);
  const [secondActionError, setSecondActionError] = useState<string | null>(null);
  const [aiUploading, setAiUploading] = useState(false);
  const [secondUploading, setSecondUploading] = useState(false);

  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const secondFileInputRef = useRef<HTMLInputElement>(null);
  const [dragSource, setDragSource] = useState<{ from: "ai" | "second"; id: number } | null>(null);
  const [dragOver, setDragOver] = useState<"ai" | "second" | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2000);
  };

  const loadAiPending = async () => {
    setLoadingAi(true);
    setErrorAi(null);
    try {
      const res = await fetch(buildApiUrl("/api/media-inbox/pending"), { cache: "no-store" });
      if (!res.ok) throw new Error(`Chyba načtení AI inboxu (${res.status})`);
      const data = (await res.json()) as { items?: AiInboxItem[] };
      setAiItems(data?.items || []);
    } catch (err) {
      setErrorAi(normalizeError(err, "Nepodařilo se načíst AI inbox"));
    } finally {
      setLoadingAi(false);
    }
  };

  const loadSecondPending = async () => {
    setLoadingSecond(true);
    setErrorSecond(null);
    try {
      const res = await fetch(buildApiUrl("/api/media-second/pending"), { cache: "no-store" });
      if (!res.ok) throw new Error(`Chyba načtení second inboxu (${res.status})`);
      const data = (await res.json()) as { items?: SecondInboxItem[] };
      setSecondItems(data?.items || []);
    } catch (err) {
      setErrorSecond(normalizeError(err, "Nepodařilo se načíst second inbox"));
    } finally {
      setLoadingSecond(false);
    }
  };

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

  useEffect(() => {
    loadAiPending();
    loadSecondPending();
  }, []);

  const toggleAi = (id: number) => {
    setAiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSecond = (id: number) => {
    setSecondSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignAiAsProducts = async () => {
    setAiActionError(null);
    if (aiSelected.size === 0) {
      setAiActionError("Vyber alespoň jednu položku.");
      return;
    }

    setBusyAi(true);
    try {
      const items = Array.from(aiSelected).map((id) => ({ inbox_id: id, assign_as: "product" }));
      const res = await fetch(buildApiUrl("/api/media-inbox/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Assign selhal (${res.status})`);
      }
      setAiSelected(new Set());
      await loadAiPending();
      showNotice("Hotovo");
    } catch (err) {
      setAiActionError(normalizeError(err, "Assign selhal"));
    } finally {
      setBusyAi(false);
    }
  };

  const moveAiToSecond = async (ids: number[]) => {
    setAiActionError(null);
    setSecondActionError(null);
    if (ids.length === 0) return;
    setBusyAi(true);
    setBusySecond(true);
    try {
      const res = await fetch(buildApiUrl("/api/media-inbox/move-to-second"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `Přesun selhal (${res.status})`);
      }
      if (data?.errors && data.errors.length > 0) {
        setAiActionError(`Některé položky se nepodařilo přesunout (${data.errors.length}).`);
      }
      setAiSelected(new Set());
      await loadAiPending();
      await loadSecondPending();
      showNotice("Hotovo");
    } catch (err) {
      setAiActionError(normalizeError(err, "Přesun selhal"));
    } finally {
      setBusyAi(false);
      setBusySecond(false);
    }
  };

  const handleAiFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAiUploading(true);
    setAiActionError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const res = await fetch(buildApiUrl("/api/media-inbox/upload"), {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string;
        rag?: { adapted?: number; new_saved?: number; new_failed?: number; total?: number };
      };
      if (!res.ok) {
        throw new Error(data?.detail || `Upload selhal (${res.status})`);
      }
      await loadAiPending();
      const rag = data?.rag;
      if (rag && typeof rag === "object" && (rag.total ?? 0) > 0) {
        const parts: string[] = [];
        if (rag.adapted) parts.push(`adaptováno: ${rag.adapted}`);
        if (rag.new_saved) parts.push(`nové: ${rag.new_saved}`);
        if (rag.new_failed) parts.push(`neuloženo: ${rag.new_failed}`);
        const msg = `RAG: ${parts.join(", ") || "Hotovo"}`;
        console.info(msg);
        showNotice(msg);
      } else {
        showNotice("Hotovo");
      }
    } catch (err) {
      setAiActionError(normalizeError(err, "Upload selhal"));
    } finally {
      setAiUploading(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = "";
    }
  };

  const deleteAiSingle = async (id: number) => {
    setAiActionError(null);
    setBusyAi(true);
    try {
      const res = await fetch(buildApiUrl(`/api/media-inbox/${id}`), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Mazání selhalo (${res.status})`);
      }
      setAiSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadAiPending();
      showNotice("Hotovo");
    } catch (err) {
      setAiActionError(normalizeError(err, "Mazání selhalo"));
    } finally {
      setBusyAi(false);
    }
  };

  const deleteAiBatch = async () => {
    setAiActionError(null);
    if (aiSelected.size === 0) {
      setAiActionError("Vyber alespoň jednu položku.");
      return;
    }
    setBusyAi(true);
    try {
      const res = await fetch(buildApiUrl("/api/media-inbox/delete-batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(aiSelected) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        errors?: { id: number }[];
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(data?.detail || `Mazání selhalo (${res.status})`);
      }
      if (data?.errors && data.errors.length > 0) {
        setAiActionError(`Některé položky se nepodařilo smazat (${data.errors.length}).`);
      }
      setAiSelected(new Set());
      await loadAiPending();
      showNotice("Hotovo");
    } catch (err) {
      setAiActionError(normalizeError(err, "Mazání selhalo"));
    } finally {
      setBusyAi(false);
    }
  };

  const deleteAiAll = async () => {
    setAiActionError(null);
    setBusyAi(true);
    try {
      const res = await fetch(buildApiUrl("/api/media-inbox/all"), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Mazání selhalo (${res.status})`);
      }
      setAiSelected(new Set());
      await loadAiPending();
      showNotice("Hotovo");
    } catch (err) {
      setAiActionError(normalizeError(err, "Mazání selhalo"));
    } finally {
      setBusyAi(false);
      setShowAiDeleteAllModal(false);
    }
  };

  const openAiVariantModal = async () => {
    setAiActionError(null);
    if (aiSelected.size === 0) {
      setAiActionError("Vyber alespoň jednu položku.");
      return;
    }
    await loadProducts();
    setSelectedProductId("");
    setShowAiVariantModal(true);
  };

  const confirmAiVariantAssign = async () => {
    if (!selectedProductId) {
      setAiActionError("Vyber hlavní produkt.");
      return;
    }

    setBusyAi(true);
    setAiActionError(null);
    try {
      const items = Array.from(aiSelected).map((id) => ({
        inbox_id: id,
        assign_as: "variant",
        parent_product_id: Number(selectedProductId),
      }));
      const res = await fetch(buildApiUrl("/api/media-inbox/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Assign selhal (${res.status})`);
      }
      setAiSelected(new Set());
      setShowAiVariantModal(false);
      await loadAiPending();
      showNotice("Hotovo");
    } catch (err) {
      setAiActionError(normalizeError(err, "Assign selhal"));
    } finally {
      setBusyAi(false);
    }
  };

  const openSecondProductModal = async () => {
    setSecondActionError(null);
    if (secondSelected.size === 0) {
      setSecondActionError("Vyber alespoň jednu položku.");
      return;
    }
    await loadProducts();
    setSelectedProductId("");
    setShowSecondProductModal(true);
  };

  const confirmSecondProductAssign = async () => {
    if (!selectedProductId) {
      setSecondActionError("Vyber produkt.");
      return;
    }

    setBusySecond(true);
    setSecondActionError(null);
    try {
      const items = Array.from(secondSelected).map((id) => ({
        second_inbox_id: id,
        assign_to_product: Number(selectedProductId),
      }));
      const res = await fetch(buildApiUrl("/api/media-second/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Assign selhal (${res.status})`);
      }
      setSecondSelected(new Set());
      setShowSecondProductModal(false);
      await loadSecondPending();
      showNotice("Hotovo");
    } catch (err) {
      setSecondActionError(normalizeError(err, "Assign selhal"));
    } finally {
      setBusySecond(false);
    }
  };

  const openSecondVariantModal = async () => {
    setSecondActionError(null);
    if (secondSelected.size === 0) {
      setSecondActionError("Vyber alespoň jednu položku.");
      return;
    }
    await loadProducts();
    setSelectedVariantId("");
    setShowSecondVariantModal(true);
  };

  const variantOptions = useMemo(() => {
    const options: { id: number; label: string }[] = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        if (!v.id) return;
        const label = `${p.name} — ${v.variant_name || "Varianta"} (#${v.id})`;
        options.push({ id: v.id, label });
      });
    });
    return options;
  }, [products]);

  const confirmSecondVariantAssign = async () => {
    if (!selectedVariantId) {
      setSecondActionError("Vyber variantu.");
      return;
    }

    setBusySecond(true);
    setSecondActionError(null);
    try {
      const items = Array.from(secondSelected).map((id) => ({
        second_inbox_id: id,
        assign_to_variant: Number(selectedVariantId),
      }));
      const res = await fetch(buildApiUrl("/api/media-second/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Assign selhal (${res.status})`);
      }
      setSecondSelected(new Set());
      setShowSecondVariantModal(false);
      await loadSecondPending();
      showNotice("Hotovo");
    } catch (err) {
      setSecondActionError(normalizeError(err, "Assign selhal"));
    } finally {
      setBusySecond(false);
    }
  };

  const moveSecondToAi = async (ids: number[]) => {
    setAiActionError(null);
    setSecondActionError(null);
    if (ids.length === 0) return;
    setBusyAi(true);
    setBusySecond(true);
    try {
      const res = await fetch(buildApiUrl("/api/media-second/move-to-ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `Přesun selhal (${res.status})`);
      }
      if (data?.errors && data.errors.length > 0) {
        setSecondActionError(`Některé položky se nepodařilo přesunout (${data.errors.length}).`);
      }
      setSecondSelected(new Set());
      await loadSecondPending();
      await loadAiPending();
      showNotice("Hotovo");
    } catch (err) {
      setSecondActionError(normalizeError(err, "Přesun selhal"));
    } finally {
      setBusyAi(false);
      setBusySecond(false);
    }
  };

  const handleDragStart = (from: "ai" | "second", id: number) => (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    setDragSource({ from, id });
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOver(null);
  };

  const handleDropOnAi = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!dragSource || dragSource.from !== "second") return;
    const ids = secondSelected.size > 0 ? Array.from(secondSelected) : [dragSource.id];
    await moveSecondToAi(ids);
    setDragSource(null);
    setDragOver(null);
  };

  const handleDropOnSecond = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!dragSource || dragSource.from !== "ai") return;
    const ids = aiSelected.size > 0 ? Array.from(aiSelected) : [dragSource.id];
    await moveAiToSecond(ids);
    setDragSource(null);
    setDragOver(null);
  };

  const handleSecondFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSecondUploading(true);
    setSecondActionError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const res = await fetch(buildApiUrl("/api/media-second/upload"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Upload selhal (${res.status})`);
      }
      await loadSecondPending();
      showNotice("Hotovo");
    } catch (err) {
      setSecondActionError(normalizeError(err, "Upload selhal"));
    } finally {
      setSecondUploading(false);
      if (secondFileInputRef.current) secondFileInputRef.current.value = "";
    }
  };

  const deleteSecondSingle = async (id: number) => {
    setSecondActionError(null);
    setBusySecond(true);
    try {
      const res = await fetch(buildApiUrl(`/api/media-second/${id}`), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Mazání selhalo (${res.status})`);
      }
      setSecondSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadSecondPending();
      showNotice("Hotovo");
    } catch (err) {
      setSecondActionError(normalizeError(err, "Mazání selhalo"));
    } finally {
      setBusySecond(false);
    }
  };

  const deleteSecondBatch = async () => {
    setSecondActionError(null);
    if (secondSelected.size === 0) {
      setSecondActionError("Vyber alespoň jednu položku.");
      return;
    }
    setBusySecond(true);
    try {
      const res = await fetch(buildApiUrl("/api/media-second/delete-batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(secondSelected) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        errors?: { id: number }[];
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(data?.detail || `Mazání selhalo (${res.status})`);
      }
      if (data?.errors && data.errors.length > 0) {
        setSecondActionError(`Některé položky se nepodařilo smazat (${data.errors.length}).`);
      }
      setSecondSelected(new Set());
      await loadSecondPending();
      showNotice("Hotovo");
    } catch (err) {
      setSecondActionError(normalizeError(err, "Mazání selhalo"));
    } finally {
      setBusySecond(false);
    }
  };

  const deleteSecondAll = async () => {
    setSecondActionError(null);
    setBusySecond(true);
    try {
      const res = await fetch(buildApiUrl("/api/media-second/all"), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Mazání selhalo (${res.status})`);
      }
      setSecondSelected(new Set());
      await loadSecondPending();
      showNotice("Hotovo");
    } catch (err) {
      setSecondActionError(normalizeError(err, "Mazání selhalo"));
    } finally {
      setBusySecond(false);
      setShowSecondDeleteAllModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Media Inbox</h2>
        <p className="text-sm text-gray-600">
          AI Inbox vytváří hlavní fotky produktů/variant. Second Inbox přidává pouze galerie.
        </p>
      </div>

      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${
            dragOver === "ai" && dragSource?.from === "second" ? "ring-2 ring-emerald-400" : ""
          }`}
          onDragOver={(e) => {
            if (dragSource?.from === "second") {
              e.preventDefault();
            }
          }}
          onDragEnter={() => {
            if (dragSource?.from === "second") setDragOver("ai");
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDropOnAi}
        >
          <input
            ref={aiFileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAiFiles(e.target.files)}
          />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">AI Inbox</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => aiFileInputRef.current?.click()}
                disabled={busyAi || aiUploading}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
              >
                Nahrát nové fotky
              </button>
              <button
                type="button"
                onClick={assignAiAsProducts}
                disabled={busyAi || aiUploading}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
              >
                Vytvořit produkty z vybraných
              </button>
              <button
                type="button"
                onClick={openAiVariantModal}
                disabled={busyAi || aiUploading}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
              >
                Přiřadit jako varianty
              </button>
              <button
                type="button"
                onClick={deleteAiBatch}
                disabled={busyAi || aiUploading}
                className="rounded-md border border-red-300 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Smazat vybrané
              </button>
              <button
                type="button"
                onClick={() => setShowAiDeleteAllModal(true)}
                disabled={busyAi || aiUploading}
                className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
              >
                Smazat vše v AI inboxu
              </button>
            </div>
          </div>

          {aiActionError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {aiActionError}
            </div>
          )}

          {loadingAi && <div className="text-sm text-gray-500">Načítání...</div>}
          {errorAi && <div className="text-sm text-red-600">{errorAi}</div>}

          {!loadingAi && !errorAi && aiItems.length === 0 && (
            <div className="rounded-md border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-500">
              Žádné pending položky
            </div>
          )}

          {!loadingAi && !errorAi && aiItems.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {aiItems.map((item) => {
                const previewUrl = resolveMediaUrl(item.webp_path);
                const checked = aiSelected.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col rounded-lg border p-2 text-xs transition ${
                      checked ? "border-emerald-400 bg-emerald-50" : "border-gray-200"
                    }`}
                    draggable
                    onDragStart={handleDragStart("ai", item.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="relative mb-2 h-28 overflow-hidden rounded bg-gray-100">
                      {previewUrl ? (
                        <img src={previewUrl} alt={item.filename || "Media"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">Bez náhledu</div>
                      )}
                      <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white">
                        {item.product_type || "—"}
                      </span>
                    </div>
                  <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-700">{item.filename || "—"}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAiSingle(item.id);
                          }}
                          className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50"
                        >
                          🗑️
                        </button>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAi(item.id)}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${
            dragOver === "second" && dragSource?.from === "ai" ? "ring-2 ring-emerald-400" : ""
          }`}
          onDragOver={(e) => {
            if (dragSource?.from === "ai") {
              e.preventDefault();
            }
          }}
          onDragEnter={() => {
            if (dragSource?.from === "ai") setDragOver("second");
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDropOnSecond}
        >
          <input
            ref={secondFileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleSecondFiles(e.target.files)}
          />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Second Inbox</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => secondFileInputRef.current?.click()}
                disabled={busySecond || secondUploading}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
              >
                Nahrát obrázky do galerie
              </button>
              <button
                type="button"
                onClick={openSecondProductModal}
                disabled={busySecond || secondUploading}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
              >
                Přidat do galerie produktu
              </button>
              <button
                type="button"
                onClick={openSecondVariantModal}
                disabled={busySecond || secondUploading}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-60"
              >
                Přidat do galerie varianty
              </button>
              <button
                type="button"
                onClick={deleteSecondBatch}
                disabled={busySecond || secondUploading}
                className="rounded-md border border-red-300 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Smazat vybrané
              </button>
              <button
                type="button"
                onClick={() => setShowSecondDeleteAllModal(true)}
                disabled={busySecond || secondUploading}
                className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
              >
                Smazat vše v Second inboxu
              </button>
            </div>
          </div>

          {secondActionError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {secondActionError}
            </div>
          )}

          {loadingSecond && <div className="text-sm text-gray-500">Načítání...</div>}
          {errorSecond && <div className="text-sm text-red-600">{errorSecond}</div>}

          {!loadingSecond && !errorSecond && secondItems.length === 0 && (
            <div className="rounded-md border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-500">
              Žádné pending položky
            </div>
          )}

          {!loadingSecond && !errorSecond && secondItems.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {secondItems.map((item) => {
                const previewUrl = resolveMediaUrl(item.webp_path);
                const checked = secondSelected.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col rounded-lg border p-2 text-xs transition ${
                      checked ? "border-emerald-400 bg-emerald-50" : "border-gray-200"
                    }`}
                    draggable
                    onDragStart={handleDragStart("second", item.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="relative mb-2 h-28 overflow-hidden rounded bg-gray-100">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Media" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">Bez náhledu</div>
                      )}
                      {item.product_type && (
                        <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white">
                          {item.product_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-700">
                        {item.filename ? item.filename : `ID ${item.id}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSecondSingle(item.id);
                          }}
                          className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50"
                        >
                          🗑️
                        </button>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSecond(item.id)}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showAiVariantModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold">Přiřadit jako varianty</h4>
            <p className="text-xs text-gray-500">Vyber hlavní produkt pro všechny vybrané fotky.</p>
            {productsError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {productsError}
              </div>
            )}
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Hlavní produkt</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={productsLoading}
              >
                <option value="">— vyber —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (#{p.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAiVariantModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={confirmAiVariantAssign}
                disabled={busyAi || productsLoading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Potvrdit
              </button>
            </div>
          </div>
        </div>
      )}

      {showSecondProductModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold">Galerie produktu</h4>
            <p className="text-xs text-gray-500">Vyber produkt pro všechny vybrané fotky.</p>
            {productsError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {productsError}
              </div>
            )}
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Produkt</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={productsLoading}
              >
                <option value="">— vyber —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (#{p.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSecondProductModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={confirmSecondProductAssign}
                disabled={busySecond || productsLoading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Potvrdit
              </button>
            </div>
          </div>
        </div>
      )}

      {showSecondVariantModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold">Galerie varianty</h4>
            <p className="text-xs text-gray-500">Vyber variantu pro všechny vybrané fotky.</p>
            {productsError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {productsError}
              </div>
            )}
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Varianta</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                disabled={productsLoading}
              >
                <option value="">— vyber —</option>
                {variantOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSecondVariantModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={confirmSecondVariantAssign}
                disabled={busySecond || productsLoading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Potvrdit
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiDeleteAllModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold">Smazat vše v AI inboxu</h4>
            <p className="text-sm text-gray-600">
              Opravdu chcete smazat VŠECHNY položky z AI inboxu?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAiDeleteAllModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={deleteAiAll}
                disabled={busyAi}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Smazat vše
              </button>
            </div>
          </div>
        </div>
      )}

      {showSecondDeleteAllModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold">Smazat vše v Second inboxu</h4>
            <p className="text-sm text-gray-600">
              Opravdu chcete smazat VŠECHNY položky ze Second inboxu?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSecondDeleteAllModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={deleteSecondAll}
                disabled={busySecond}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Smazat vše
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
