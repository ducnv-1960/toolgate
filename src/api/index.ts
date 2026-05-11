import express from "express";
import cors from "cors";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";
import { buildServersRouter } from "./routes/servers.js";
import { buildToolsRouter } from "./routes/tools.js";
import { buildIntegrationsRouter } from "./routes/integrations.js";
import { buildLogsRouter } from "./routes/logs.js";
import { buildSettingsRouter } from "./routes/settings.js";
import { mountMcpRouter } from "../hub/server.js";
import type { MCPClientManager } from "../client/manager.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIST = resolve(__dirname, "../../dashboard/dist");

export async function createApp(clientManager: MCPClientManager, port: number): Promise<express.Application> {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // REST API
  app.use("/api/servers", buildServersRouter(clientManager, port));
  app.use("/api/tools", buildToolsRouter(clientManager));
  app.use("/api/integrations", buildIntegrationsRouter(() => port));
  app.use("/api/logs", buildLogsRouter());
  app.use("/api/settings", buildSettingsRouter());

  // MCP Hub endpoint — stateful per-session transports
  mountMcpRouter(app, clientManager);

  // Serve React dashboard in production
  if (existsSync(DASHBOARD_DIST)) {
    app.use(express.static(DASHBOARD_DIST));
    app.get("*", (_req, res) => {
      res.sendFile(join(DASHBOARD_DIST, "index.html"));
    });
  }

  return app;
}
