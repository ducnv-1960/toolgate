import type { MCPClientManager } from "../../client/manager.js";
import { getToolByServerAndName } from "../../config/db.js";

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

export function buildHandleExecuteTool(clientManager: MCPClientManager) {
  return async function handleExecuteTool(args: {
    server_id: string;
    tool_name: string;
    arguments?: Record<string, unknown>;
  }): Promise<object> {
    const { server_id, tool_name, arguments: toolArgs = {} } = args;

    const tool = getToolByServerAndName(server_id, tool_name);
    if (!tool) {
      throw new Error(
        `Tool "${tool_name}" not found on server "${server_id}". Use search_tools or list_tools to find available tools.`
      );
    }

    const client = clientManager.getClient(server_id);
    if (!client) {
      throw new Error(
        `Server "${server_id}" is not connected. Check the hub dashboard to reconnect.`
      );
    }

    const result = await client.callTool({
      name: tool_name,
      arguments: toolArgs,
    });

    return { result };
  };
}
