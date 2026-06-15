import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { startWorker } from "./services/ingest-worker.js";

// Server bootstrap. Importing ./config/env validates the environment and throws
// on a misconfigured deploy before we bind the port. The Hono app itself lives
// in ./app.js so it can be imported without starting a server.
serve({ fetch: app.fetch, port: env.PORT });
console.log(`entri API on http://localhost:${env.PORT}`);

// In-process ingest worker (no-op until OpenRouter + Cloudflare + Sarvam creds are set).
startWorker();
