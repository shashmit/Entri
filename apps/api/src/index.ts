import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { startWorker } from "./services/ingest-worker.js";

// Importing ./config/env validates the environment and throws on a misconfigured
// deploy before anything else runs.
//
// Two runtimes share this entry:
//   • Vercel (serverless): the Hono framework preset imports the DEFAULT export
//     below and invokes `app.fetch` per request — there's no port to bind and no
//     room for a persistent poll loop, so we skip both. The ingest queue is
//     drained by POST /internal/drain (Vercel Cron + a waitUntil nudge from the
//     capture route) instead of the in-process worker.
//   • A long-running Node host (incl. local `pnpm dev`): bind the port and start
//     the in-process ingest worker, exactly as before.
if (!env.VERCEL) {
  serve({ fetch: app.fetch, port: env.PORT });
  console.log(`entri API on http://localhost:${env.PORT}`);
  // In-process ingest worker (no-op until OpenRouter + Cloudflare + Sarvam creds are set).
  startWorker();
}

export default app;
