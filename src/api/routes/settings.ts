import { Router } from "express";
import { getSetting, setSetting } from "../../config/db.js";
import { EMBEDDING_MODELS, DEFAULT_MODEL_ID, clearModelCache, getActiveModelId } from "../../search/embedding.js";
import { reindexAll } from "../../search/indexer.js";

type ReindexState = { status: "idle" | "indexing"; error?: string };
let _reindexState: ReindexState = { status: "idle" };

async function triggerReindex(): Promise<void> {
  if (_reindexState.status === "indexing") return;
  _reindexState = { status: "indexing" };
  try {
    await reindexAll();
    _reindexState = { status: "idle" };
  } catch (err) {
    _reindexState = { status: "idle", error: String(err) };
    console.error("[Settings] Re-index failed:", err);
  }
}

export function buildSettingsRouter(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const embeddingModel = getActiveModelId();
    res.json({
      embeddingModel,
      models: EMBEDDING_MODELS,
      reindexStatus: _reindexState.status,
    });
  });

  router.put("/", async (req, res) => {
    const { embeddingModel } = req.body as { embeddingModel?: string };
    if (!embeddingModel) {
      res.status(400).json({ error: "embeddingModel required" });
      return;
    }
    if (!EMBEDDING_MODELS.find((m) => m.id === embeddingModel)) {
      res.status(400).json({ error: "Unknown model id" });
      return;
    }

    const prev = getSetting("embedding_model", DEFAULT_MODEL_ID);
    setSetting("embedding_model", embeddingModel);

    if (prev !== embeddingModel) {
      clearModelCache(prev);
      // Run re-index in background — don't block the response
      triggerReindex().catch(() => {});
    }

    res.json({ ok: true, reindexStatus: _reindexState.status });
  });

  router.post("/reindex", async (_req, res) => {
    if (_reindexState.status === "indexing") {
      res.json({ ok: false, message: "Already indexing" });
      return;
    }
    triggerReindex().catch(() => {});
    res.json({ ok: true });
  });

  router.get("/reindex-status", (_req, res) => {
    res.json(_reindexState);
  });

  return router;
}
