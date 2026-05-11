import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

interface Server {
  id: string;
  name: string;
}

interface Tool {
  serverId: string;
  serverName: string;
  name: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export default function TesterPage() {
  const location = useLocation();
  const initState = location.state as
    | { serverId?: string; toolName?: string }
    | null;

  const [servers, setServers] = useState<Server[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedServer, setSelectedServer] = useState(
    initState?.serverId ?? ""
  );
  const [selectedTool, setSelectedTool] = useState(initState?.toolName ?? "");
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((s: any[]) =>
        setServers(s.map((x) => ({ id: x.id, name: x.name })))
      );
  }, []);

  useEffect(() => {
    if (!selectedServer) return;
    fetch(`/api/tools?server_id=${encodeURIComponent(selectedServer)}`)
      .then((r) => r.json())
      .then((data) => {
        const ts = data.tools.map((t: any) => ({
          serverId: t.serverId,
          serverName: t.serverName,
          name: t.name ?? t.toolName,
          toolName: t.name ?? t.toolName,
          description: t.description,
          inputSchema: t.inputSchema ?? {},
        }));
        setTools(ts);
        if (!selectedTool && ts.length > 0) setSelectedTool(ts[0].toolName);
      });
  }, [selectedServer]);

  const currentTool = tools.find(
    (t) => t.toolName === selectedTool || t.name === selectedTool
  );

  useEffect(() => {
    if (currentTool) {
      setArgs(JSON.stringify(buildDefaultArgs(currentTool.inputSchema), null, 2));
    }
  }, [selectedTool]);

  async function handleExecute() {
    setError(null);
    setResult(null);
    setExecuting(true);

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(args);
    } catch {
      setError("Invalid JSON in arguments");
      setExecuting(false);
      return;
    }

    try {
      const res = await fetch("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_id: selectedServer,
          tool_name: selectedTool,
          arguments: parsedArgs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Execution failed");
      } else {
        setResult(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setError(String(e));
    }
    setExecuting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tool Tester</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Server</label>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
            value={selectedServer}
            onChange={(e) => {
              setSelectedServer(e.target.value);
              setSelectedTool("");
              setTools([]);
              setResult(null);
              setError(null);
            }}
          >
            <option value="">Select server...</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tool</label>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
            value={selectedTool}
            onChange={(e) => {
              setSelectedTool(e.target.value);
              setResult(null);
              setError(null);
            }}
            disabled={!selectedServer}
          >
            <option value="">Select tool...</option>
            {tools.map((t) => (
              <option key={t.toolName} value={t.toolName}>
                {t.toolName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentTool && (
        <div className="bg-gray-800 rounded-lg p-3 mb-4 border border-gray-700">
          <p className="text-sm text-gray-300">{currentTool.description}</p>
          {currentTool.inputSchema && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                Input schema
              </summary>
              <pre className="text-xs text-gray-400 mt-2 overflow-auto">
                {JSON.stringify(currentTool.inputSchema, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Arguments (JSON)</label>
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm font-mono h-40 focus:outline-none focus:border-indigo-500"
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          placeholder="{}"
        />
      </div>

      <button
        onClick={handleExecute}
        disabled={!selectedServer || !selectedTool || executing}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-md text-sm font-medium"
      >
        {executing ? "Executing..." : "Execute"}
      </button>

      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-4">
          <p className="text-sm font-medium text-red-400 mb-1">Error</p>
          <pre className="text-xs text-red-300 whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && (
        <div className="mt-4 bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm font-medium text-green-400 mb-2">Result</p>
          <pre className="text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

function buildDefaultArgs(schema: Record<string, unknown>): Record<string, unknown> {
  const props = (schema?.properties ?? {}) as Record<string, { type?: string }>;
  const required = (schema?.required ?? []) as string[];
  const result: Record<string, unknown> = {};
  for (const key of required) {
    const prop = props[key];
    result[key] = prop?.type === "number" ? 0 : prop?.type === "boolean" ? false : "";
  }
  return result;
}
