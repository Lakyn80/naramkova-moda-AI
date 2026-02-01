"use client";

import { useState } from "react";
import { deleteMedia } from "../../../lib/api";

export default function AdminMediaPage() {
  const [mediaId, setMediaId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleDelete(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const id = Number(mediaId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Zadej platné ID média.");
      return;
    }

    setLoading(true);
    try {
      await deleteMedia(id);
      setSuccess(`Médium ${id} bylo odstraněno.`);
      setMediaId("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Smazání selhalo";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Média</h2>
        <p className="text-sm text-gray-500">Ruční smazání média podle ID.</p>
      </div>

      <form onSubmit={handleDelete} className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <label className="text-sm font-medium text-gray-700">ID média</label>
          <input
            type="number"
            min={1}
            value={mediaId}
            onChange={(event) => setMediaId(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="např. 123"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {loading ? "Mažu..." : "Smazat médium"}
          </button>
          {success && <span className="text-sm text-emerald-600">{success}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
