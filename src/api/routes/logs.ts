import { Router } from "express";
import { getLogs, clearLogs } from "../../logs/store.js";

export function buildLogsRouter(): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.page_size as string) || 50, 100);
    res.json(getLogs(page, pageSize));
  });

  router.delete("/", (_req, res) => {
    clearLogs();
    res.json({ success: true });
  });

  return router;
}
