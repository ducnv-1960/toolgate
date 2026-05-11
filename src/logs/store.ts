import { randomUUID } from "crypto";

export interface LogEntry {
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

const MAX_ENTRIES = 500;
const entries: LogEntry[] = [];

export function addLog(entry: Omit<LogEntry, "id">): LogEntry {
  const log: LogEntry = { id: randomUUID(), ...entry };
  entries.unshift(log);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  return log;
}

export function getLogs(page = 1, pageSize = 50): {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    logs: entries.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function clearLogs(): void {
  entries.length = 0;
}
