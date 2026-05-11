import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import type { MCPServerRecord, ToolRecord, TransportConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, "hub.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      transport_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      error_message TEXT,
      tool_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      input_schema_json TEXT NOT NULL DEFAULT '{}',
      indexed_at INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tools_server_id ON tools(server_id);
    CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
  `);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// --- Settings ---

export function getSetting(key: string, defaultValue: string): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

// --- MCP Server CRUD ---

export function listServers(): MCPServerRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM mcp_servers ORDER BY created_at DESC")
    .all() as any[];
  return rows.map(rowToServer);
}

export function getServer(id: string): MCPServerRecord | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM mcp_servers WHERE id = ?")
    .get(id) as any;
  return row ? rowToServer(row) : undefined;
}

export function insertServer(server: MCPServerRecord): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO mcp_servers (id, name, transport_json, created_at, status, error_message, tool_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    server.id,
    server.name,
    JSON.stringify(server.transport),
    server.createdAt,
    server.status,
    server.errorMessage ?? null,
    server.toolCount
  );
}

export function updateServerStatus(
  id: string,
  status: MCPServerRecord["status"],
  errorMessage?: string
): void {
  const db = getDb();
  db.prepare(
    "UPDATE mcp_servers SET status = ?, error_message = ? WHERE id = ?"
  ).run(status, errorMessage ?? null, id);
}

export function updateServerToolCount(id: string, count: number): void {
  const db = getDb();
  db.prepare("UPDATE mcp_servers SET tool_count = ? WHERE id = ?").run(
    count,
    id
  );
}

export function updateServer(id: string, name: string, transport: TransportConfig): void {
  const db = getDb();
  db.prepare("UPDATE mcp_servers SET name = ?, transport_json = ? WHERE id = ?").run(
    name,
    JSON.stringify(transport),
    id
  );
}

export function deleteServer(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(id);
}

// --- Tool CRUD ---

export function listTools(serverId?: string): ToolRecord[] {
  const db = getDb();
  const rows = serverId
    ? (db
        .prepare("SELECT * FROM tools WHERE server_id = ? ORDER BY name")
        .all(serverId) as any[])
    : (db.prepare("SELECT * FROM tools ORDER BY name").all() as any[]);
  return rows.map(rowToTool);
}

export function getTool(id: string): ToolRecord | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tools WHERE id = ?").get(id) as any;
  return row ? rowToTool(row) : undefined;
}

export function getToolByServerAndName(
  serverId: string,
  toolName: string
): ToolRecord | undefined {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM tools WHERE server_id = ? AND name = ?")
    .get(serverId, toolName) as any;
  return row ? rowToTool(row) : undefined;
}

export function upsertTools(tools: ToolRecord[]): void {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO tools (id, server_id, server_name, name, description, input_schema_json, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      input_schema_json = excluded.input_schema_json,
      indexed_at = excluded.indexed_at
  `);
  const batch = db.transaction((ts: ToolRecord[]) => {
    for (const t of ts) {
      upsert.run(
        t.id,
        t.serverId,
        t.serverName,
        t.name,
        t.description,
        JSON.stringify(t.inputSchema),
        t.indexedAt
      );
    }
  });
  batch(tools);
}

export function replaceToolsForServer(serverId: string, tools: ToolRecord[]): void {
  const db = getDb();
  const del = db.prepare("DELETE FROM tools WHERE server_id = ?");
  const upsert = db.prepare(`
    INSERT INTO tools (id, server_id, server_name, name, description, input_schema_json, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      input_schema_json = excluded.input_schema_json,
      indexed_at = excluded.indexed_at
  `);
  db.transaction(() => {
    del.run(serverId);
    for (const t of tools) {
      upsert.run(t.id, t.serverId, t.serverName, t.name, t.description, JSON.stringify(t.inputSchema), t.indexedAt);
    }
  })();
}

export function deleteToolsByServer(serverId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM tools WHERE server_id = ?").run(serverId);
}

// --- Helpers ---

function rowToServer(row: any): MCPServerRecord {
  return {
    id: row.id,
    name: row.name,
    transport: JSON.parse(row.transport_json) as TransportConfig,
    createdAt: row.created_at,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    toolCount: row.tool_count,
  };
}

function rowToTool(row: any): ToolRecord {
  return {
    id: row.id,
    serverId: row.server_id,
    serverName: row.server_name,
    name: row.name,
    description: row.description,
    inputSchema: JSON.parse(row.input_schema_json),
    indexedAt: row.indexed_at,
  };
}
