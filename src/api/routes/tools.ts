import { Router } from "express";
import { listTools } from "../../config/db.js";
import { searchTools as searchToolsFromIndex, indexTools, removeServerFromIndex } from "../../search/indexer.js";
import { buildHandleExecuteTool } from "../../hub/tools/execute.js";
import type { MCPClientManager } from "../../client/manager.js";

export function buildToolsRouter(clientManager: MCPClientManager): Router {
  const router = Router();
  const handleExecuteTool = buildHandleExecuteTool(clientManager, "rest");

  // GET /api/tools?server_id=...
  router.get("/", (req, res) => {
    const serverId = req.query.server_id as string | undefined;
    const tools = listTools(serverId);
    res.json({ tools, total: tools.length });
  });

  // GET /api/tools/search?q=...&limit=10
  router.get("/search", async (req, res) => {
    const q = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!q) return res.status(400).json({ error: "q parameter is required" });

    try {
      const results = await searchToolsFromIndex(q, limit);
      res.json({
        results: results.map((r) => ({
          serverId: r.tool.serverId,
          serverName: r.tool.serverName,
          toolName: r.tool.name,
          description: r.tool.description,
          score: Math.round(r.score * 1000) / 1000,
          inputSchema: r.tool.inputSchema,
        })),
        total: results.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/tools/reindex — rebuild the vector index from current DB tools
  router.post("/reindex", async (_req, res) => {
    try {
      const allTools = listTools();
      // Group by server so we can clear + re-add per server atomically
      const byServer = new Map<string, typeof allTools>();
      for (const t of allTools) {
        if (!byServer.has(t.serverId)) byServer.set(t.serverId, []);
        byServer.get(t.serverId)!.push(t);
      }
      for (const [serverId, tools] of byServer) {
        await removeServerFromIndex(serverId);
        await indexTools(tools);
      }
      res.json({ success: true, reindexed: allTools.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/tools/execute
  router.post("/execute", async (req, res) => {
    const { server_id, tool_name, arguments: toolArgs } = req.body as {
      server_id?: string;
      tool_name?: string;
      arguments?: Record<string, unknown>;
    };

    if (!server_id || !tool_name) {
      return res
        .status(400)
        .json({ error: "server_id and tool_name are required" });
    }

    try {
      const result = await handleExecuteTool({
        server_id,
        tool_name,
        arguments: toolArgs,
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
