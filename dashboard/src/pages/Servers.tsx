import { useState, useEffect, useCallback, useRef } from "react";

interface TransportConfig {
  type: "stdio" | "sse" | "streamable-http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

interface Server {
  id: string;
  name: string;
  transport: TransportConfig;
  status: string;
  connected: boolean;
  toolCount: number;
  errorMessage?: string;
}

type FormState = typeof EMPTY_FORM;

function ServerFormFields({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Name</label>
        <input required className="w-full bg-gray-700 rounded px-3 py-2 text-sm" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="my-server" />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Transport</label>
        <select className="w-full bg-gray-700 rounded px-3 py-2 text-sm" value={form.transportType}
          onChange={(e) => setForm((f) => ({ ...f, transportType: e.target.value as TransportConfig["type"] }))}>
          <option value="stdio">stdio (local process)</option>
          <option value="sse">SSE / HTTP</option>
          <option value="streamable-http">Streamable HTTP (MCP 2025)</option>
        </select>
      </div>
      {form.transportType === "stdio" ? (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Command</label>
            <input required className="w-full bg-gray-700 rounded px-3 py-2 text-sm" value={form.command}
              onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))} placeholder="npx" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Args (one per line)</label>
            <textarea className="w-full bg-gray-700 rounded px-3 py-2 text-sm h-20" value={form.args}
              onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
              placeholder={`-y\n@modelcontextprotocol/server-filesystem\n/tmp`} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Env (JSON, optional)</label>
            <input className="w-full bg-gray-700 rounded px-3 py-2 text-sm" value={form.env}
              onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))} placeholder='{"MY_VAR": "value"}' />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm text-gray-400 mb-1">URL</label>
            <input required className="w-full bg-gray-700 rounded px-3 py-2 text-sm" value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="http://localhost:8080/mcp" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Headers (JSON, optional)</label>
            <input className="w-full bg-gray-700 rounded px-3 py-2 text-sm" value={form.headers}
              onChange={(e) => setForm((f) => ({ ...f, headers: e.target.value }))} placeholder='{"Authorization": "Bearer token"}' />
          </div>
        </>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500",
  disconnected: "bg-gray-500",
  error: "bg-red-500",
};

const EMPTY_FORM = {
  name: "",
  transportType: "stdio" as TransportConfig["type"],
  command: "",
  args: "",
  env: "",
  url: "",
  headers: "",
};

function serverToForm(s: Server) {
  const t = s.transport;
  return {
    name: s.name,
    transportType: t.type,
    command: t.type === "stdio" ? (t.command ?? "") : "",
    args: t.type === "stdio" ? (t.args ?? []).join("\n") : "",
    env: t.type === "stdio" && t.env ? JSON.stringify(t.env, null, 2) : "",
    url: t.type !== "stdio" ? (t.url ?? "") : "",
    headers: t.type !== "stdio" && t.headers ? JSON.stringify(t.headers, null, 2) : "",
  };
}

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const fetchServers = useCallback(async () => {
    const res = await fetch("/api/servers");
    setServers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServers();

    function startPolling() {
      intervalRef.current = setInterval(fetchServers, 3000);
    }
    function stopPolling() {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    function onVisibility() {
      document.visibilityState === "visible" ? startPolling() : stopPolling();
    }

    startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchServers]);

  function buildTransport(): TransportConfig | null {
    try {
      if (form.transportType === "stdio") {
        return {
          type: "stdio",
          command: form.command,
          args: form.args ? form.args.split("\n").filter(Boolean) : [],
          env: form.env ? JSON.parse(form.env) : undefined,
        };
      }
      return {
        type: form.transportType as "sse" | "streamable-http",
        url: form.url,
        headers: form.headers ? JSON.parse(form.headers) : undefined,
      };
    } catch {
      return null;
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const transport = buildTransport();
    if (!transport) { setFormError("Invalid JSON in env/headers field"); return; }

    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, transport }),
    });

    if (!res.ok) { setFormError((await res.json()).error ?? "Failed to add server"); return; }
    setShowForm(false);
    setForm(EMPTY_FORM);
    fetchServers();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!editingServer) return;
    const transport = buildTransport();
    if (!transport) { setFormError("Invalid JSON in env/headers field"); return; }

    const res = await fetch(`/api/servers/${editingServer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, transport }),
    });

    if (!res.ok) { setFormError((await res.json()).error ?? "Failed to update server"); return; }
    setEditingServer(null);
    setForm(EMPTY_FORM);
    fetchServers();
  }

  function openEdit(s: Server) {
    setEditingServer(s);
    setForm(serverToForm(s));
    setShowForm(false);
    setFormError("");
  }

  function closeEdit() {
    setEditingServer(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove server "${name}"?`)) return;
    setActionLoading(id + ":delete");
    await fetch(`/api/servers/${id}`, { method: "DELETE" });
    setActionLoading(null);
    fetchServers();
  }

  async function handleReconnect(id: string) {
    setActionLoading(id + ":reconnect");
    await fetch(`/api/servers/${id}/reconnect`, { method: "POST" });
    setActionLoading(null);
    fetchServers();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">MCP Servers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Add Server"}
        </button>
      </div>

      {editingServer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleEdit}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700 w-full max-w-lg"
          >
            <h2 className="text-lg font-semibold mb-4">Edit Server</h2>
            {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}
            <ServerFormFields form={form} setForm={setForm} />
            <div className="flex gap-2 mt-4">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm">
                Save & Reconnect
              </button>
              <button type="button" onClick={closeEdit} className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-md text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700"
        >
          <h2 className="text-lg font-semibold mb-4">Add MCP Server</h2>
          {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}
          <ServerFormFields form={form} setForm={setForm} />
          <button type="submit" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm">
            Add & Connect
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : servers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No servers configured</p>
          <p className="text-sm mt-1">Click "+ Add Server" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => (
            <div
              key={s.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center gap-4"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLORS[s.status] ?? "bg-gray-500"}`}
                title={s.status}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                    {s.transport.type}
                  </span>
                  <span className="text-xs text-gray-400">{s.toolCount} tools</span>
                </div>
                {s.errorMessage && (
                  <p className="text-xs text-red-400 mt-0.5 truncate">{s.errorMessage}</p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.transport.type === "stdio"
                    ? `${s.transport.command} ${(s.transport.args ?? []).join(" ")}`
                    : s.transport.url}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(s)} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">
                  Edit
                </button>
                <button
                  onClick={() => handleReconnect(s.id)}
                  disabled={actionLoading === s.id + ":reconnect"}
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                >
                  {actionLoading === s.id + ":reconnect" ? "..." : "Reconnect"}
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  disabled={actionLoading === s.id + ":delete"}
                  className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-3 py-1 rounded"
                >
                  {actionLoading === s.id + ":delete" ? "..." : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
