import { embed } from "./embedding.js";
import {
  upsertVector,
  deleteVectorsByServerId,
  searchVectors,
} from "./vectorstore.js";
import { listTools, getTool } from "../config/db.js";
import type { ToolRecord, SearchResult } from "../config/types.js";

export async function indexTools(tools: ToolRecord[]): Promise<void> {
  for (const tool of tools) {
    const text = `${tool.name} ${tool.description}`.trim();
    const vector = await embed(text);
    await upsertVector(tool.id, vector, {
      serverId: tool.serverId,
      toolName: tool.name,
    });
  }
}

export async function removeServerFromIndex(serverId: string): Promise<void> {
  await deleteVectorsByServerId(serverId);
}

export async function searchTools(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const queryVector = await embed(query);
  const results = await searchVectors(queryVector, limit);

  const searchResults: SearchResult[] = [];
  for (const r of results) {
    const toolId = r.id;
    const tool = getTool(toolId);
    if (tool) {
      searchResults.push({ tool, score: r.score });
    }
  }
  return searchResults;
}
