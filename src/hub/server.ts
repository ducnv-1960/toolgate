import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import type { MCPClientManager } from "../client/manager.js";
import { searchToolsDef, handleSearchTools } from "./tools/search.js";
import { executeToolDef, buildHandleExecuteTool } from "./tools/execute.js";
import { listToolsDef, handleListTools } from "./tools/list.js";

export function createHubServer(clientManager: MCPClientManager): McpServer {
  const server = new McpServer({
    name: "mcp-hub",
    version: "1.0.0",
  });

  const handleExecuteTool = buildHandleExecuteTool(clientManager);

  // search_tools
  server.tool(
    searchToolsDef.name,
    searchToolsDef.description,
    {
      query: z.string().describe("Natural language query describing what you want to do"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
    },
    async ({ query, limit }) => {
      const result = await handleSearchTools({ query, limit });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // execute_tool
  server.tool(
    executeToolDef.name,
    executeToolDef.description,
    {
      server_id: z.string().describe("The ID of the MCP server that owns this tool"),
      tool_name: z.string().describe("The exact name of the tool to execute"),
      arguments: z
        .record(z.unknown())
        .optional()
        .describe("Arguments to pass to the tool"),
    },
    async ({ server_id, tool_name, arguments: toolArgs }) => {
      const result = await handleExecuteTool({
        server_id,
        tool_name,
        arguments: toolArgs as Record<string, unknown> | undefined,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // list_tools
  server.tool(
    listToolsDef.name,
    listToolsDef.description,
    {
      server_id: z
        .string()
        .optional()
        .describe("Optional: filter tools by server ID"),
    },
    async ({ server_id }) => {
      const result = await handleListTools({ server_id });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  return server;
}

export function mountMcpRouter(
  app: express.Application,
  server: McpServer
): void {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  server.connect(transport);

  app.post("/mcp", async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    await transport.handleRequest(req, res);
  });
}
