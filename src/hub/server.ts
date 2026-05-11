import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import { randomUUID } from "crypto";
import type { MCPClientManager } from "../client/manager.js";
import { searchToolsDef, handleSearchTools } from "./tools/search.js";
import { executeToolDef, buildHandleExecuteTool } from "./tools/execute.js";
import { listToolsDef, handleListTools } from "./tools/list.js";

export function createHubServer(clientManager: MCPClientManager): McpServer {
  const server = new McpServer({
    name: "toolgate",
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
  clientManager: MCPClientManager
): void {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId) {
        const transport = sessions.get(sessionId);
        if (!transport) { res.status(404).end(); return; }
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // New session — sessionId is assigned during handleRequest
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      const server = createHubServer(clientManager);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      // sessionId is set by the SDK during handleRequest
      if (transport.sessionId) sessions.set(transport.sessionId, transport);
    } catch (err) {
      console.error("[Toolgate] POST error:", err);
      if (!res.headersSent) res.status(500).end();
    }
  });

  app.get("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId) { res.status(400).end(); return; }
      const transport = sessions.get(sessionId);
      if (!transport) { res.status(404).end(); return; }
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("[Toolgate] GET error:", err);
      if (!res.headersSent) res.status(500).end();
    }
  });

  app.delete("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId) { res.status(400).end(); return; }
      const transport = sessions.get(sessionId);
      if (!transport) { res.status(404).end(); return; }
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("[Toolgate] DELETE error:", err);
      if (!res.headersSent) res.status(500).end();
    }
  });
}
