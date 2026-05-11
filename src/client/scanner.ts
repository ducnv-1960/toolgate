import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { randomUUID } from "crypto";
import type { ToolRecord } from "../config/types.js";

export async function scanTools(
  client: Client,
  serverId: string,
  serverName: string
): Promise<ToolRecord[]> {
  const response = await client.listTools();
  const now = Date.now();

  return response.tools.map((tool) => ({
    id: `${serverId}:${tool.name}`,
    serverId,
    serverName,
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {},
    indexedAt: now,
  }));
}
