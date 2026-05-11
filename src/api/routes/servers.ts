import { Router } from "express";
import { randomUUID } from "crypto";
import {
  listServers,
  getServer,
  insertServer,
  updateServer,
  deleteServer,
} from "../../config/db.js";
import type { MCPClientManager } from "../../client/manager.js";
import type { TransportConfig } from "../../config/types.js";

export function buildServersRouter(clientManager: MCPClientManager, port: number): Router {
  const router = Router();

  function isSelfUrl(transport: TransportConfig): boolean {
    if (transport.type === "stdio") return false;
    try {
      const u = new URL(transport.url);
      const isLocal = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
      return isLocal && parseInt(u.port || "80") === port;
    } catch { return false; }
  }

  // GET /api/servers
  router.get("/", (_req, res) => {
    const servers = listServers().map((s) => ({
      ...s,
      connected: clientManager.isConnected(s.id),
    }));
    res.json(servers);
  });

  // GET /api/servers/:id
  router.get("/:id", (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    res.json({ ...server, connected: clientManager.isConnected(server.id) });
  });

  // POST /api/servers
  router.post("/", async (req, res) => {
    const { name, transport } = req.body as {
      name?: string;
      transport?: TransportConfig;
    };

    if (!name || !transport) {
      return res.status(400).json({ error: "name and transport are required" });
    }
    if (!["stdio", "sse", "streamable-http"].includes(transport.type)) {
      return res.status(400).json({ error: "Invalid transport type" });
    }
    if (isSelfUrl(transport)) {
      return res.status(400).json({ error: "Cannot add Toolgate itself as a child server — this would cause an infinite loop" });
    }

    const id = randomUUID();
    const server = {
      id,
      name,
      transport,
      createdAt: Date.now(),
      status: "disconnected" as const,
      toolCount: 0,
    };

    insertServer(server);

    // Connect asynchronously
    clientManager.connect(server).catch((err) => {
      console.error(`[API] Failed to connect ${name}:`, err.message);
    });

    res.status(201).json(server);
  });

  // PUT /api/servers/:id
  router.put("/:id", async (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: "Server not found" });

    const { name, transport } = req.body as { name?: string; transport?: TransportConfig };
    if (!name || !transport) return res.status(400).json({ error: "name and transport are required" });
    if (!["stdio", "sse", "streamable-http"].includes(transport.type)) {
      return res.status(400).json({ error: "Invalid transport type" });
    }
    if (isSelfUrl(transport)) {
      return res.status(400).json({ error: "Cannot point a server at Toolgate itself" });
    }

    updateServer(server.id, name, transport);
    const updated = getServer(server.id)!;

    // Reconnect with new config
    clientManager.reconnect(updated).catch((err) => {
      console.error(`[API] Failed to reconnect ${name}:`, err.message);
    });

    res.json(updated);
  });

  // DELETE /api/servers/:id
  router.delete("/:id", async (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: "Server not found" });

    await clientManager.disconnect(server.id);
    deleteServer(server.id);
    res.json({ success: true });
  });

  // POST /api/servers/:id/reconnect
  router.post("/:id/reconnect", async (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: "Server not found" });

    try {
      await clientManager.reconnect(server);
      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // GET /api/servers/:id/status
  router.get("/:id/status", (req, res) => {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    res.json({
      id: server.id,
      status: server.status,
      connected: clientManager.isConnected(server.id),
      errorMessage: server.errorMessage,
      toolCount: server.toolCount,
    });
  });

  return router;
}
