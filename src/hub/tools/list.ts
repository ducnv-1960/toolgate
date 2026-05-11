import { listTools } from "../../config/db.js";

export const listToolsDef = {
  name: "list_tools",
  description:
    "List all available MCP tools across connected servers, with optional filtering by server.",
  inputSchema: {
    type: "object",
    properties: {
      server_id: {
        type: "string",
        description: "Optional: filter tools by server ID",
      },
    },
    required: [],
  },
};

export async function handleListTools(args: {
  server_id?: string;
}): Promise<object> {
  const tools = listTools(args.server_id);

  return {
    tools: tools.map((t) => ({
      serverId: t.serverId,
      serverName: t.serverName,
      toolName: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    total: tools.length,
  };
}
