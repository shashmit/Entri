import { Hono } from "hono";
import { waitUntil } from "@vercel/functions";
import { env } from "../config/env.js";
import { drainQueue } from "../services/ingest-worker.js";

// Internal, platform-triggered endpoints. Not mounted under /v1 (no user auth);
// guarded instead by CRON_SECRET so only Vercel Cron (which sends it as a bearer)
// — never the public — can trigger the AI-spending ingest drain.
export const internal = new Hono();

// POST /internal/drain — drain the ingest queue. On Vercel the heavy work runs in
// the background (waitUntil) so the request returns immediately; the function
// stays alive until the drain finishes, bounded by the function's maxDuration.
internal.post("/drain", async (c) => {
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || c.req.header("Authorization") !== expected) {
    return c.json({ error: "unauthorized" }, 401);
  }
  if (env.VERCEL) {
    waitUntil(drainQueue());
    return c.json({ ok: true });
  }
  // Local / long-running host: the in-process worker already drains; run inline.
  const result = await drainQueue();
  return c.json(result);
});
