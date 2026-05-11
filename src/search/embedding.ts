import { pipeline, env } from "@huggingface/transformers";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getSetting } from "../config/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_CACHE = join(__dirname, "../../data/models");

env.cacheDir = MODEL_CACHE;

export interface ModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  queryPrefix: string;
}

export const EMBEDDING_MODELS: ModelOption[] = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    label: "MiniLM-L6",
    size: "~22 MB",
    description: "Super light. Fast, symmetric similarity. Good baseline.",
    queryPrefix: "",
  },
  {
    id: "Xenova/bge-small-en-v1.5",
    label: "BGE-small",
    size: "~23 MB",
    description: "Light. Retrieval-optimized — better search quality at same size.",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
  },
  {
    id: "Xenova/bge-base-en-v1.5",
    label: "BGE-base",
    size: "~87 MB",
    description: "Medium. Best quality among lightweight models. Requires ~200MB RAM.",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
  },
];

export const DEFAULT_MODEL_ID = EMBEDDING_MODELS[1].id; // bge-small

export function getActiveModelId(): string {
  return getSetting("embedding_model", DEFAULT_MODEL_ID);
}

export function getActiveModel(): ModelOption {
  const id = getActiveModelId();
  return EMBEDDING_MODELS.find((m) => m.id === id) ?? EMBEDDING_MODELS[1];
}

// Per-model pipeline + embedding cache
const _pipelines = new Map<string, Awaited<ReturnType<typeof pipeline>>>();
const _caches = new Map<string, Map<string, number[]>>();
const CACHE_MAX = 256;

export async function getEmbeddingPipeline(modelId?: string): Promise<Awaited<ReturnType<typeof pipeline>>> {
  const id = modelId ?? getActiveModelId();
  if (_pipelines.has(id)) return _pipelines.get(id)!;

  console.log(`[Embedding] Loading model ${id} (may download on first run)...`);
  const ext = await pipeline("feature-extraction", id, { dtype: "fp32" });
  _pipelines.set(id, ext);
  console.log(`[Embedding] Model ${id} ready.`);
  return ext;
}

export async function embed(text: string, modelId?: string): Promise<number[]> {
  const id = modelId ?? getActiveModelId();

  if (!_caches.has(id)) _caches.set(id, new Map());
  const cache = _caches.get(id)!;

  const cached = cache.get(text);
  if (cached) return cached;

  const extractor = await getEmbeddingPipeline(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await extractor(text, { pooling: "mean", normalize: true });
  const vector = Array.from(result.data as Float32Array);

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(text, vector);
  return vector;
}

// Use query prefix for retrieval models (asymmetric search)
export async function embedQuery(query: string): Promise<number[]> {
  const model = getActiveModel();
  const text = model.queryPrefix ? `${model.queryPrefix}${query}` : query;
  return embed(text);
}

export function clearModelCache(modelId?: string): void {
  if (modelId) {
    _caches.delete(modelId);
    _pipelines.delete(modelId);
  } else {
    _caches.clear();
    _pipelines.clear();
  }
}
