import { pipeline, env } from "@huggingface/transformers";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_CACHE = join(__dirname, "../../data/models");

env.cacheDir = MODEL_CACHE;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let _extractor: Awaited<ReturnType<typeof pipeline>> | null = null;

export async function getEmbeddingPipeline() {
  if (_extractor) return _extractor;

  console.log("[Embedding] Loading local model (first run may download ~25MB)...");
  _extractor = await pipeline("feature-extraction", MODEL_ID, {
    dtype: "fp32",
  });
  console.log("[Embedding] Model ready.");
  return _extractor;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await extractor(text, { pooling: "mean", normalize: true });
  // For feature-extraction pipelines, result is a Tensor with a .data Float32Array
  return Array.from(result.data as Float32Array);
}
