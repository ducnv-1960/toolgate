import { createApp } from "./api/index.js";
import { MCPClientManager } from "./client/manager.js";
import { indexTools, removeServerFromIndex, rebuildBm25 } from "./search/indexer.js";
import { getEmbeddingPipeline } from "./search/embedding.js";
import { listServers } from "./config/db.js";
import type { ToolRecord } from "./config/types.js";

const PORT = parseInt(process.env.PORT ?? "3000");

async function main() {
  console.log("[MCP Hub] Starting...");

  // Rebuild BM25 index from existing DB tools (in-memory, fast)
  rebuildBm25();

  // Pre-load embedding model to avoid delay on first search
  getEmbeddingPipeline().catch((err) =>
    console.warn("[MCP Hub] Embedding model pre-load failed:", err.message)
  );

  const clientManager = new MCPClientManager(
    async (serverId: string, tools: ToolRecord[]) => {
      try {
        await removeServerFromIndex(serverId);
        await indexTools(tools);
        console.log(
          `[MCP Hub] Indexed ${tools.length} tools for server ${serverId}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[MCP Hub] Indexing failed for ${serverId}: ${msg}`);
      }
    }
  );

  // Reconnect all previously configured servers
  const servers = listServers();
  if (servers.length > 0) {
    console.log(`[MCP Hub] Reconnecting ${servers.length} configured server(s)...`);
    await Promise.allSettled(
      servers.map((s) =>
        clientManager.connect(s).catch((err) =>
          console.warn(`[MCP Hub] Could not connect ${s.name}: ${err.message}`)
        )
      )
    );
  }

  const app = await createApp(clientManager, PORT);

  const httpServer = app.listen(PORT, () => {
    console.log(`[MCP Hub] Running on http://localhost:${PORT}`);
    console.log(`  Dashboard:  http://localhost:${PORT}/`);
    console.log(`  MCP Server: http://localhost:${PORT}/mcp`);
    console.log(`  REST API:   http://localhost:${PORT}/api`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[MCP Hub] Shutting down...");
    await clientManager.disconnectAll();
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[MCP Hub] Fatal error:", err);
  process.exit(1);
});
