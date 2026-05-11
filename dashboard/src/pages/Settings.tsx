import { useState, useEffect } from "react";

interface ModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  queryPrefix: string;
}

interface SettingsData {
  embeddingModel: string;
  models: ModelOption[];
  reindexStatus: "idle" | "indexing";
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  async function fetchSettings() {
    const res = await fetch("/api/settings");
    const d: SettingsData = await res.json();
    setData(d);
    setSelected(d.embeddingModel);
    if (d.reindexStatus === "indexing") {
      setReindexing(true);
      pollReindexStatus();
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  function pollReindexStatus() {
    const interval = setInterval(async () => {
      const res = await fetch("/api/settings/reindex-status");
      const { status } = await res.json();
      if (status !== "indexing") {
        setReindexing(false);
        clearInterval(interval);
        fetchSettings();
      }
    }, 1500);
  }

  async function handleSave() {
    if (!data || selected === data.embeddingModel) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeddingModel: selected }),
    });
    setSaving(false);
    setSaved(true);
    setReindexing(true);
    setTimeout(() => setSaved(false), 2000);
    pollReindexStatus();
    fetchSettings();
  }

  async function handleReindex() {
    setReindexing(true);
    await fetch("/api/settings/reindex", { method: "POST" });
    pollReindexStatus();
  }

  if (!data) return <p className="text-gray-400">Loading...</p>;

  const changed = selected !== data.embeddingModel;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-gray-400 text-sm">
          Configure embedding model and search behavior.
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="font-semibold text-base mb-1">Embedding Model</h2>
        <p className="text-sm text-gray-400 mb-5">
          Used to convert tool descriptions into vectors for semantic search.
          Changing the model will trigger a full re-index of all tools.
        </p>

        <div className="space-y-3">
          {data.models.map((m) => {
            const isActive = m.id === selected;
            const isCurrent = m.id === data.embeddingModel;
            return (
              <label
                key={m.id}
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  isActive
                    ? "border-indigo-500 bg-indigo-950/40"
                    : "border-gray-700 hover:border-gray-500"
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={isActive}
                  onChange={() => setSelected(m.id)}
                  className="mt-0.5 accent-indigo-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{m.label}</span>
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                      {m.size}
                    </span>
                    {isCurrent && !changed && (
                      <span className="text-xs bg-green-900/50 text-green-400 border border-green-700 px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                    {m.queryPrefix && (
                      <span className="text-xs text-indigo-400" title="Uses asymmetric query prefix for retrieval">
                        retrieval-optimized
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{m.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!changed || saving || reindexing}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-5 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Apply & Re-index"}
          </button>

          {saved && !reindexing && (
            <span className="text-sm text-green-400">Saved</span>
          )}

          {reindexing && (
            <span className="text-sm text-indigo-400 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Re-indexing...
            </span>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="font-semibold text-base mb-1">Re-index Tools</h2>
        <p className="text-sm text-gray-400 mb-4">
          Rebuild the vector index from scratch using the current model. Use this
          if search results seem stale or incorrect.
        </p>
        <button
          onClick={handleReindex}
          disabled={reindexing}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-5 rounded-lg transition-colors"
        >
          {reindexing ? "Indexing..." : "Re-index now"}
        </button>
      </div>
    </div>
  );
}
