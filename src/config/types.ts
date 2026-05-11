export type TransportType = "stdio" | "sse" | "streamable-http";

export interface StdioTransportConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SseTransportConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export interface StreamableHttpTransportConfig {
  type: "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

export type TransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;

export type ConnectionStatus = "connected" | "disconnected" | "error" | "connecting";

export interface MCPServerRecord {
  id: string;
  name: string;
  transport: TransportConfig;
  createdAt: number;
  status: ConnectionStatus;
  errorMessage?: string;
  toolCount: number;
}

export interface ToolRecord {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  indexedAt: number;
}

export interface SearchResult {
  tool: ToolRecord;
  score: number;
}
