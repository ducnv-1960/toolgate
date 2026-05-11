import { searchTools } from "../../search/indexer.js";
import type { SearchResult } from "../../config/types.js";

export const searchToolsDef = {
  name: "search_tools",
  description:
    "Search for MCP tools across all connected servers using semantic search. Returns the most relevant tools for your query.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language query describing what you want to do",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 10)",
      },
    },
    required: ["query"],
  },
};

export async function handleSearchTools(args: {
  query: string;
  limit?: number;
}): Promise<object> {
  const results = await searchTools(args.query, args.limit ?? 10);

  return {
    results: results.map((r: SearchResult) => ({
      serverId: r.tool.serverId,
      serverName: r.tool.serverName,
      toolName: r.tool.name,
      description: r.tool.description,
      score: Math.round(r.score * 1000) / 1000,
      inputSchema: r.tool.inputSchema,
    })),
    total: results.length,
  };
}
