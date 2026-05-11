import { LocalIndex } from "vectra";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { existsSync, mkdirSync, rmSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTOR_DIR = join(__dirname, "../../data/vectors");

if (!existsSync(VECTOR_DIR)) {
  mkdirSync(VECTOR_DIR, { recursive: true });
}

export interface VectorItem {
  id: string;
  metadata: Record<string, string>;
}

let _index: LocalIndex | null = null;

async function getIndex(): Promise<LocalIndex> {
  if (_index) return _index;

  const index = new LocalIndex(VECTOR_DIR);
  try {
    if (await index.isIndexCreated()) {
      // Validate by doing a cheap read — catches corrupt JSON files
      await index.listItemsByMetadata({});
    } else {
      await index.createIndex();
    }
    _index = index;
  } catch {
    // Corrupted index — wipe and recreate
    console.warn("[VectorStore] Index corrupted, recreating...");
    rmSync(VECTOR_DIR, { recursive: true, force: true });
    mkdirSync(VECTOR_DIR, { recursive: true });
    const fresh = new LocalIndex(VECTOR_DIR);
    await fresh.createIndex();
    _index = fresh;
  }
  return _index;
}

export async function upsertVector(
  id: string,
  vector: number[],
  metadata: Record<string, string>
): Promise<void> {
  const index = await getIndex();
  await index.upsertItem({ id, vector, metadata });
}

export async function deleteVectorsByServerId(serverId: string): Promise<void> {
  const index = await getIndex();
  const items = await index.listItemsByMetadata({ serverId });
  for (const item of items) {
    await index.deleteItem(item.id as string);
  }
}

export async function clearAllVectors(): Promise<void> {
  const index = await getIndex();
  const items = await index.listItemsByMetadata({});
  for (const item of items) {
    await index.deleteItem(item.id as string);
  }
}

export async function searchVectors(
  queryVector: number[],
  topK: number = 10
): Promise<Array<{ id: string; score: number; metadata: Record<string, string> }>> {
  const index = await getIndex();
  const results = await index.queryItems(queryVector, topK);
  return results.map((r) => ({
    id: r.item.id as string,
    score: r.score,
    metadata: r.item.metadata as Record<string, string>,
  }));
}
