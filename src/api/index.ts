import express from "express";
import cors from "cors";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";
import { buildServersRouter } from "./routes/servers.js";
import { buildToolsRouter } from "./routes/tools.js";
import { buildIntegrationsRouter } from "./routes/integrations.js";
import { createHubServer, mountMcpRouter } from "../hub/server.js";
import type { MCPClientManager } from "../client/manager.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIST = resolve(__dirname, "../../dashboard/dist");

export function createApp(clientManager: MCPClientManager, port: number): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // REST API
  app.use("/api/servers", buildServersRouter(clientManager));
  app.use("/api/tools", buildToolsRouter(clientManager));
  app.use("/api/integrations", buildIntegrationsRouter(() => port));

  // MCP Hub endpoint
  const hubServer = createHubServer(clientManager);
  mountMcpRouter(app, hubServer);

  // Serve React dashboard in production
  if (existsSync(DASHBOARD_DIST)) {
    app.use(express.static(DASHBOARD_DIST));
    app.get("*", (_req, res) => {
      res.sendFile(join(DASHBOARD_DIST, "index.html"));
    });
  }

  return app;
}
