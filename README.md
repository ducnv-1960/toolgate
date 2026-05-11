# Toolgate

Connect multiple MCP servers in one place. Instead of adding each server separately to every AI tool you use, add them once to Toolgate — then connect your AI tools to the hub.

**What you get:**

- **Semantic search** — AI can find the right tool across all your servers using natural language, no exact name needed
- **Single endpoint** — one URL to register in VS Code, Claude Code, or any MCP client
- **Web dashboard** — add/remove servers, browse tools, and test them in the browser
- **All transports** — supports stdio (local processes), SSE, and Streamable HTTP

## Token efficiency

When an AI assistant connects directly to multiple MCP servers, it receives the full tool list from every server at the start of each session. With many servers, this can consume a significant portion of the context window before any real work begins.

Toolgate exposes only 3 tools to the AI (`search_tools`, `execute_tool`, `list_tools`). The AI searches for what it needs on demand rather than receiving everything upfront — potentially reducing token usage from tool definitions substantially.

> **Note:** This token-saving effect is the primary motivation for the hub design, but it is currently experimental. No formal benchmarks or measurements have been published. Actual savings depend on the number of servers, model, and client behavior.

## Install

Requires Node.js 18+.

```bash
npm install
cd dashboard && npm install && npm run build && cd ..
npm run dev
```

Open <http://localhost:3000> — the dashboard lets you add your MCP servers and register Toolgate into VS Code / Claude Code with one click.

> First run downloads a local embedding model (~25 MB, cached to `./data/models/`).

## Connect to your AI tool

After starting Toolgate, go to the **Integrations** page in the dashboard and click **Add to config**. Or add manually:

### VS Code / Claude Code

```json
{
  "mcpServers": {
    "toolgate": { "type": "http", "url": "http://localhost:3000/mcp" }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "toolgate": { "type": "http", "url": "http://localhost:3000/mcp" }
  }
}
```

## Environment

| Variable | Default | Description                           |
|----------|---------|---------------------------------------|
| `PORT`   | `3000`  | Port for dashboard and MCP endpoint   |
