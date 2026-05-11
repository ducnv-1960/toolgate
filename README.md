# MCP Hub

Aggregates multiple MCP servers into one, providing semantic tool search and unified execution.

## Features

- **Semantic tool search** — find tools across all connected servers using natural language (local embedding model, no API key required)
- **Unified execute** — call any tool on any connected server through a single interface
- **All MCP transports** — stdio (local processes), SSE, and Streamable HTTP (MCP 2025 spec)
- **Web dashboard** — manage servers, browse tools, and test tool execution directly in the browser
- **Auto-reconnect** — reconnects to configured servers on restart and after disconnections

## Quick Start

```bash
npm install
cd dashboard && npm install && npm run build && cd ..
npm run dev
```

Open http://localhost:3000 for the dashboard.

## Integrate with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hub": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## MCP Tools

| Tool | Description |
|---|---|
| `search_tools(query, limit?)` | Semantic search for tools matching your query |
| `execute_tool(server_id, tool_name, arguments?)` | Execute a tool on a specific server |
| `list_tools(server_id?)` | List all indexed tools, optionally filtered by server |

## REST API

```
GET    /api/servers              # List configured servers
POST   /api/servers              # Add server (triggers connect + index)
DELETE /api/servers/:id          # Remove server
POST   /api/servers/:id/reconnect# Reconnect + re-index
GET    /api/servers/:id/status   # Connection status

GET    /api/tools                # List tools (?server_id=...)
GET    /api/tools/search?q=...   # Semantic search
POST   /api/tools/execute        # Execute: {server_id, tool_name, arguments}
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port for both dashboard and MCP endpoint |

## Adding a stdio Server (Example)

```json
{
  "name": "filesystem",
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
  }
}
```

## Data

Runtime data is stored in `./data/`:
- `hub.db` — SQLite database (server configs, tool records)
- `vectors/` — Vectra vector store (tool embeddings)
- `models/` — Cached local embedding model (~25 MB, downloaded on first run)
