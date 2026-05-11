import { Router } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { homedir, platform } from "os";
import { join } from "path";

function getVSCodeMcpPath(): string {
  const home = homedir();
  switch (platform()) {
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "Code", "User", "mcp.json");
    case "darwin":
      return join(home, "Library", "Application Support", "Code", "User", "mcp.json");
    default: // linux
      return join(process.env.XDG_CONFIG_HOME ?? join(home, ".config"), "Code", "User", "mcp.json");
  }
}

const VSCODE_MCP_PATH = getVSCodeMcpPath();
const CLAUDE_CODE_PATH = join(homedir(), ".claude.json");
const HUB_SERVER_NAME = "mcp-hub";

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(path: string, data: Record<string, unknown>): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, "\t"), "utf8");
}

function getHubUrl(port: number): string {
  return `http://localhost:${port}/mcp`;
}

function checkVSCode(port: number): { configured: boolean; url?: string; samePort: boolean } {
  const cfg = readJson(VSCODE_MCP_PATH);
  const servers = (cfg.servers ?? {}) as Record<string, any>;
  const entry = servers[HUB_SERVER_NAME];
  if (!entry) return { configured: false, samePort: false };
  return {
    configured: true,
    url: entry.url,
    samePort: entry.url === getHubUrl(port),
  };
}

function checkClaudeCode(port: number): { configured: boolean; url?: string; samePort: boolean } {
  const cfg = readJson(CLAUDE_CODE_PATH);
  const servers = (cfg.mcpServers ?? {}) as Record<string, any>;
  const entry = servers[HUB_SERVER_NAME];
  if (!entry) return { configured: false, samePort: false };
  return {
    configured: true,
    url: entry.url,
    samePort: entry.url === getHubUrl(port),
  };
}

export function buildIntegrationsRouter(getPort: () => number): Router {
  const router = Router();

  // GET /api/integrations
  router.get("/", (req, res) => {
    const port = getPort();
    res.json({
      hubUrl: getHubUrl(port),
      vscode: {
        path: VSCODE_MCP_PATH,
        exists: existsSync(VSCODE_MCP_PATH),
        ...checkVSCode(port),
      },
      claudeCode: {
        path: CLAUDE_CODE_PATH,
        exists: existsSync(CLAUDE_CODE_PATH),
        ...checkClaudeCode(port),
      },
    });
  });

  // POST /api/integrations/vscode
  router.post("/vscode", (req, res) => {
    const port = getPort();
    const url = getHubUrl(port);
    try {
      const cfg = readJson(VSCODE_MCP_PATH);
      if (!cfg.servers) cfg.servers = {};
      if (!cfg.inputs) cfg.inputs = [];
      (cfg.servers as Record<string, unknown>)[HUB_SERVER_NAME] = {
        type: "http",
        url,
      };
      writeJson(VSCODE_MCP_PATH, cfg);
      res.json({ success: true, url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // DELETE /api/integrations/vscode
  router.delete("/vscode", (req, res) => {
    try {
      const cfg = readJson(VSCODE_MCP_PATH);
      const servers = (cfg.servers ?? {}) as Record<string, unknown>;
      delete servers[HUB_SERVER_NAME];
      cfg.servers = servers;
      writeJson(VSCODE_MCP_PATH, cfg);
      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/integrations/claude-code
  router.post("/claude-code", (req, res) => {
    const port = getPort();
    const url = getHubUrl(port);
    try {
      const cfg = readJson(CLAUDE_CODE_PATH);
      if (!cfg.mcpServers) cfg.mcpServers = {};
      (cfg.mcpServers as Record<string, unknown>)[HUB_SERVER_NAME] = {
        type: "http",
        url,
      };
      writeJson(CLAUDE_CODE_PATH, cfg);
      res.json({ success: true, url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // DELETE /api/integrations/claude-code
  router.delete("/claude-code", (req, res) => {
    try {
      const cfg = readJson(CLAUDE_CODE_PATH);
      const servers = (cfg.mcpServers ?? {}) as Record<string, unknown>;
      delete servers[HUB_SERVER_NAME];
      cfg.mcpServers = servers;
      writeJson(CLAUDE_CODE_PATH, cfg);
      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
