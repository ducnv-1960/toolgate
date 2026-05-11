import { useState, useEffect, useRef } from "react";

interface LogEntry {
  id: string;
  timestamp: number;
  serverId: string;
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs: number;
  caller: "mcp" | "rest";
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isError = !!entry.error;

  return (
    <div
      className={`border-b border-gray-700/50 ${isError ? "bg-red-950/20" : ""}`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-2.5 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3 text-sm">
          {/* Status dot */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isError ? "bg-red-500" : "bg-green-500"
            }`}
          />

          {/* Time */}
          <span className="text-gray-500 w-16 flex-shrink-0 text-xs">
            {timeAgo(entry.timestamp)}
          </span>

          {/* Caller badge */}
          <span
            className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
              entry.caller === "mcp"
                ? "bg-indigo-900/60 text-indigo-300"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            {entry.caller.toUpperCase()}
          </span>

          {/* Server + tool */}
          <span className="text-gray-400 flex-shrink-0">{entry.serverName}</span>
          <span className="text-gray-600 flex-shrink-0">/</span>
          <span className="text-white font-mono font-medium">{entry.toolName}</span>

          {/* Args preview */}
          <span className="text-gray-500 text-xs truncate flex-1 min-w-0">
            {Object.keys(entry.arguments).length > 0
              ? JSON.stringify(entry.arguments).slice(0, 80)
              : "—"}
          </span>

          {/* Duration */}
          <span className="text-gray-500 text-xs flex-shrink-0 ml-auto">
            {entry.durationMs}ms
          </span>

          {/* Error short */}
          {isError && (
            <span className="text-red-400 text-xs flex-shrink-0 max-w-[160px] truncate">
              {entry.error}
            </span>
          )}

          {/* Chevron */}
          <span
            className={`text-gray-600 flex-shrink-0 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Arguments</p>
            <pre className="bg-gray-900 rounded p-3 text-xs font-mono text-gray-300 overflow-x-auto max-h-48">
              {JSON.stringify(entry.arguments, null, 2)}
            </pre>
          </div>
          {entry.error ? (
            <div>
              <p className="text-xs text-red-400 mb-1 font-medium">Error</p>
              <pre className="bg-red-950/40 border border-red-800/40 rounded p-3 text-xs font-mono text-red-300 overflow-x-auto max-h-48">
                {entry.error}
              </pre>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Result</p>
              <pre className="bg-gray-900 rounded p-3 text-xs font-mono text-gray-300 overflow-x-auto max-h-64">
                {JSON.stringify(entry.result, null, 2)}
              </pre>
            </div>
          )}
          <p className="text-xs text-gray-600">
            {new Date(entry.timestamp).toLocaleString()} · {entry.durationMs}ms ·{" "}
            {entry.serverId}
          </p>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

interface PagedLogs {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function LogsPage() {
  const [data, setData] = useState<PagedLogs>({ logs: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchLogs(p = page) {
    const res = await fetch(`/api/logs?page=${p}&page_size=${PAGE_SIZE}`);
    setData(await res.json());
  }

  useEffect(() => { fetchLogs(page); }, [page]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && page === 1) {
      intervalRef.current = setInterval(() => fetchLogs(1), 3000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, page]);

  async function handleClear() {
    await fetch("/api/logs", { method: "DELETE" });
    setPage(1);
    setData({ logs: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  }

  function goToPage(p: number) {
    setPage(p);
  }

  function handleFilterChange(value: string) {
    setFilter(value);
    if (page !== 1) setPage(1);
  }

  const filtered = filter
    ? data.logs.filter(
        (l) =>
          l.toolName.includes(filter) ||
          l.serverName.toLowerCase().includes(filter.toLowerCase()) ||
          l.error?.toLowerCase().includes(filter.toLowerCase())
      )
    : data.logs;

  const errorCount = data.logs.filter((l) => l.error).length;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Logs</h1>
          <p className="text-gray-400 text-sm">
            Last 500 tool executions, in-memory
          </p>
        </div>
        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="text-xs bg-red-900/50 text-red-400 border border-red-800 px-2 py-1 rounded-full">
              {errorCount} error{errorCount > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-gray-500">{data.total} total</span>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              autoRefresh && page === 1
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-700"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            {autoRefresh && page === 1 ? "● Live" : "Paused"}
          </button>
          <button
            onClick={() => fetchLogs(page)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg"
          >
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded-lg"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter by tool name, server, or error..."
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-700/40 text-xs text-gray-500 flex items-center gap-3 border-b border-gray-700">
          <span className="w-2" />
          <span className="w-16">Time</span>
          <span className="w-10">Via</span>
          <span className="w-20">Server</span>
          <span className="w-40">Tool</span>
          <span className="flex-1">Arguments</span>
          <span className="ml-auto">Duration</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            {data.total === 0
              ? "No tool executions yet. Tools called via MCP or the Tester will appear here."
              : "No entries match the filter."}
          </div>
        ) : (
          filtered.map((entry) => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500">
            Page {data.page} of {data.totalPages} · {data.total} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={data.page === 1}
              className="text-xs px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300"
            >
              «
            </button>
            <button
              onClick={() => goToPage(data.page - 1)}
              disabled={data.page === 1}
              className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300"
            >
              Prev
            </button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - data.page) <= 2)
              .map((p) => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`text-xs px-3 py-1.5 rounded transition-colors ${
                    p === data.page
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            <button
              onClick={() => goToPage(data.page + 1)}
              disabled={data.page === data.totalPages}
              className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300"
            >
              Next
            </button>
            <button
              onClick={() => goToPage(data.totalPages)}
              disabled={data.page === data.totalPages}
              className="text-xs px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
