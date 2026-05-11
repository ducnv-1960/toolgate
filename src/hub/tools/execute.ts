import type { MCPClientManager } from "../../client/manager.js";
import { getToolByServerAndName } from "../../config/db.js";
import { addLog } from "../../logs/store.js";

const TOOL_TIMEOUT_MS = parseInt(process.env.TOOL_TIMEOUT_MS ?? "30000");

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tool "${label}" timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

export const executeToolDef = {
  name: "execute_tool",
  description:
    "Execute a specific MCP tool on a connected server. Use search_tools first to find the correct server_id and tool_name.",
  inputSchema: {
    type: "object",
    properties: {
      server_id: {
        type: "string",
        description: "The ID of the MCP server that owns this tool",
      },
      tool_name: {
        type: "string",
        description: "The exact name of the tool to execute",
      },
      arguments: {
        type: "object",
        description: "Arguments to pass to the tool",
      },
    },
    required: ["server_id", "tool_name"],
  },
};

export function buildHandleExecuteTool(
  clientManager: MCPClientManager,
  caller: "mcp" | "rest" = "mcp"
) {
  return async function handleExecuteTool(args: {
    server_id: string;
    tool_name: string;
    arguments?: Record<string, unknown>;
  }): Promise<object> {
    const { server_id, tool_name, arguments: toolArgs = {} } = args;
    const start = Date.now();

    const tool = getToolByServerAndName(server_id, tool_name);
    if (!tool) {
      const error = `Tool "${tool_name}" not found on server "${server_id}". Use search_tools or list_tools to find available tools.`;
      addLog({ timestamp: start, serverId: server_id, serverName: "", toolName: tool_name, arguments: toolArgs, error, durationMs: 0, caller });
      throw new Error(error);
    }

    const client = clientManager.getClient(server_id);
    if (!client) {
      const error = `Server "${server_id}" is not connected. Check the Toolgate dashboard to reconnect.`;
      addLog({ timestamp: start, serverId: server_id, serverName: tool.serverName, toolName: tool_name, arguments: toolArgs, error, durationMs: 0, caller });
      throw new Error(error);
    }

    try {
      const result = await withTimeout(
        client.callTool({ name: tool_name, arguments: toolArgs }),
        TOOL_TIMEOUT_MS,
        tool_name
      );
      addLog({
        timestamp: start,
        serverId: server_id,
        serverName: tool.serverName,
        toolName: tool_name,
        arguments: toolArgs,
        result,
        durationMs: Date.now() - start,
        caller,
      });
      return { result };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      addLog({
        timestamp: start,
        serverId: server_id,
        serverName: tool.serverName,
        toolName: tool_name,
        arguments: toolArgs,
        error,
        durationMs: Date.now() - start,
        caller,
      });
      throw err;
    }
  };
}
