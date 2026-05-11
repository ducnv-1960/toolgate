import { embed, embedQuery } from "./embedding.js";
import {
  upsertVector,
  deleteVectorsByServerId,
  searchVectors,
  clearAllVectors,
} from "./vectorstore.js";
import { listTools, getTool } from "../config/db.js";
import { bm25Add, bm25Remove, bm25Search, bm25Clear } from "./bm25.js";
import type { ToolRecord, SearchResult } from "../config/types.js";

function buildIndexText(tool: ToolRecord): string {
  const naturalName = tool.name.replace(/_/g, " ");
  const parts: string[] = [naturalName, tool.name, tool.description ?? ""];

  try {
    const raw = tool.inputSchema;
    const schema = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
    const props: Record<string, { description?: string }> = schema.properties ?? {};
    const paramTexts = Object.entries(props).map(([k, v]) => {
      const naturalKey = k.replace(/_/g, " ");
      return v.description ? `${naturalKey}: ${v.description}` : naturalKey;
    });
    if (paramTexts.length > 0) {
      parts.push("parameters: " + paramTexts.join(", "));
    }
  } catch {
    // malformed schema — skip params
  }

  return parts.filter(Boolean).join(". ");
}

export async function indexTools(tools: ToolRecord[]): Promise<void> {
  for (const tool of tools) {
    const text = buildIndexText(tool);
    const vector = await embed(text);
    await upsertVector(tool.id, vector, {
      serverId: tool.serverId,
      toolName: tool.name,
    });
    bm25Add(tool.id, text);
  }
}

export async function removeServerFromIndex(serverId: string): Promise<void> {
  await deleteVectorsByServerId(serverId);
  // Remove all tools for this server from BM25
  const tools = listTools(serverId);
  for (const t of tools) bm25Remove(t.id);
}

export function rebuildBm25(): void {
  bm25Clear();
  const tools = listTools();
  for (const tool of tools) {
    bm25Add(tool.id, buildIndexText(tool));
  }
  console.log(`[Indexer] BM25 index rebuilt with ${tools.length} tools`);
}

export async function reindexAll(): Promise<void> {
  const tools = listTools();
  await clearAllVectors();
  bm25Clear();
  await indexTools(tools);
}

export async function searchTools(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const candidates = Math.max(limit * 3, 30);

  // Semantic search using query-prefixed embedding (BGE asymmetric retrieval)
  const queryVector = await embedQuery(query);
  const semanticHits = await searchVectors(queryVector, candidates);

  // BM25 keyword search over full corpus, returns normalized scores
  const bm25Hits = bm25Search(query, candidates);
  const bm25Map = new Map(bm25Hits.map((h) => [h.id, h.score]));

  // Normalize BM25 scores to [0, 1] relative to max score
  const maxBm25 = bm25Hits[0]?.score ?? 1;
  const bm25Weight = 0.3;

  const seen = new Set<string>();
  const searchResults: SearchResult[] = [];

  for (const r of semanticHits) {
    seen.add(r.id);
    const tool = getTool(r.id);
    if (!tool) continue;
    const bm25Score = ((bm25Map.get(r.id) ?? 0) / maxBm25) * bm25Weight;
    searchResults.push({ tool, score: r.score + bm25Score });
  }

  // Include BM25-only hits that didn't appear in semantic results
  for (const h of bm25Hits) {
    if (seen.has(h.id)) continue;
    const tool = getTool(h.id);
    if (!tool) continue;
    const bm25Score = (h.score / maxBm25) * bm25Weight;
    searchResults.push({ tool, score: bm25Score });
  }

  searchResults.sort((a, b) => b.score - a.score);
  return searchResults.slice(0, limit);
}
