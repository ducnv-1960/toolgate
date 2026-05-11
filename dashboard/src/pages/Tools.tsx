import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface Tool {
  id?: string;
  serverId: string;
  serverName: string;
  toolName: string;
  description: string;
  score?: number;
  inputSchema: Record<string, unknown>;
}

export default function ToolsPage() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [serverFilter, setServerFilter] = useState("");
  const [servers, setServers] = useState<{ id: string; name: string }[]>([]);

  const fetchAll = useCallback(async () => {
    const url = serverFilter
      ? `/api/tools?server_id=${encodeURIComponent(serverFilter)}`
      : "/api/tools";
    const res = await fetch(url);
    const data = await res.json();
    setTools(
      data.tools.map((t: any) => ({
        serverId: t.serverId,
        serverName: t.serverName,
        toolName: t.name ?? t.toolName,
        description: t.description,
        inputSchema: t.inputSchema ?? t.input_schema ?? {},
      }))
    );
    setLoading(false);
  }, [serverFilter]);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((s: any[]) => setServers(s.map((x) => ({ id: x.id, name: x.name }))));
  }, []);

  useEffect(() => {
    if (!query) {
      fetchAll();
    }
  }, [fetchAll, query]);

  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(
        `/api/tools/search?q=${encodeURIComponent(query)}&limit=20`
      );
      const data = await res.json();
      setTools(data.results ?? []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  function openTester(tool: Tool) {
    navigate("/tester", {
      state: { serverId: tool.serverId, toolName: tool.toolName },
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tools Browser</h1>

      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
          placeholder="Search tools... (semantic search)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
          value={serverFilter}
          onChange={(e) => setServerFilter(e.target.value)}
        >
          <option value="">All servers</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading || searching ? (
        <p className="text-gray-400 text-sm">
          {searching ? "Searching..." : "Loading..."}
        </p>
      ) : tools.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>{query ? "No tools matched your search" : "No tools indexed yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map((t, i) => (
            <div
              key={`${t.serverId}:${t.toolName}:${i}`}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-indigo-600 cursor-pointer transition-colors"
              onClick={() => openTester(t)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-medium text-indigo-300">
                      {t.toolName}
                    </span>
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                      {t.serverName}
                    </span>
                    {t.score !== undefined && (
                      <span className="text-xs text-green-400">
                        score: {t.score.toFixed(3)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {t.description || "(no description)"}
                  </p>
                </div>
                <button className="text-xs text-indigo-400 hover:text-indigo-300 flex-shrink-0 mt-1">
                  Test →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
