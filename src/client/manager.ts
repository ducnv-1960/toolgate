import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  updateServerStatus,
  updateServerToolCount,
  replaceToolsForServer,
} from "../config/db.js";
import { scanTools } from "./scanner.js";
import type {
  MCPServerRecord,
  TransportConfig,
  ToolRecord,
} from "../config/types.js";

export type OnToolsIndexed = (serverId: string, tools: ToolRecord[]) => Promise<void>;

interface ManagedConnection {
  client: Client;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

const RECONNECT_DELAY_MS = 5000;

export class MCPClientManager {
  private connections = new Map<string, ManagedConnection>();
  private onToolsIndexed: OnToolsIndexed;

  constructor(onToolsIndexed: OnToolsIndexed) {
    this.onToolsIndexed = onToolsIndexed;
  }

  async connect(server: MCPServerRecord): Promise<void> {
    if (this.connections.has(server.id)) {
      await this.disconnect(server.id);
    }

    updateServerStatus(server.id, "connecting");

    try {
      const client = new Client(
        { name: "mcp-hub", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = buildTransport(server.transport);
      await client.connect(transport);

      const conn: ManagedConnection = { client };
      this.connections.set(server.id, conn);
      updateServerStatus(server.id, "connected");

      await this.indexServer(server, client);

      // Monitor for unexpected close
      transport.onclose = () => {
        this.connections.delete(server.id);
        updateServerStatus(server.id, "disconnected");
        this.scheduleReconnect(server);
      };
      transport.onerror = (err) => {
        updateServerStatus(server.id, "error", String(err));
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateServerStatus(server.id, "error", msg);
      this.scheduleReconnect(server);
      throw err;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;

    clearTimeout(conn.reconnectTimer);
    this.connections.delete(serverId);

    try {
      await conn.client.close();
    } catch {
      // Ignore close errors
    }
    updateServerStatus(serverId, "disconnected");
  }

  async reconnect(server: MCPServerRecord): Promise<void> {
    await this.disconnect(server.id);
    await this.connect(server);
  }

  getClient(serverId: string): Client | undefined {
    return this.connections.get(serverId)?.client;
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  async disconnectAll(): Promise<void> {
    const ids = [...this.connections.keys()];
    await Promise.allSettled(ids.map((id) => this.disconnect(id)));
  }

  private async indexServer(
    server: MCPServerRecord,
    client: Client
  ): Promise<void> {
    try {
      const tools = await scanTools(client, server.id, server.name);
      replaceToolsForServer(server.id, tools);
      updateServerToolCount(server.id, tools.length);
      await this.onToolsIndexed(server.id, tools);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MCPClientManager] Failed to index ${server.name}: ${msg}`);
    }
  }

  private scheduleReconnect(server: MCPServerRecord): void {
    const conn = this.connections.get(server.id);
    if (conn) return; // already reconnected

    const timer = setTimeout(async () => {
      try {
        await this.connect(server);
      } catch {
        // Will retry via onclose handler
      }
    }, RECONNECT_DELAY_MS);

    // Store timer so we can cancel on explicit disconnect
    const placeholder: ManagedConnection = { client: undefined as any, reconnectTimer: timer };
    this.connections.set(server.id, placeholder);
  }
}

function buildTransport(config: TransportConfig) {
  switch (config.type) {
    case "stdio":
      return new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: config.env,
      });

    case "sse":
      return new SSEClientTransport(new URL(config.url), {
        requestInit: config.headers
          ? { headers: config.headers }
          : undefined,
      });

    case "streamable-http":
      return new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: config.headers
          ? { headers: config.headers }
          : undefined,
      });

    default:
      throw new Error(`Unknown transport type: ${(config as any).type}`);
  }
}
