import type { ErrorHandler } from "hono";
import { InsForgeError } from "@insforge/sdk";
import type { AppEnv } from "./auth.js";

// Central error boundary (app.onError). InsForge SDK errors carry an HTTP status
// (RLS denial → 403, expired/invalid token → 401) — surface it so the SPA can
// refresh and retry. Anything else is logged and returned as an opaque 500.
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof InsForgeError) {
    return c.json({ error: err.message }, ((err.statusCode as number) ?? 500) as 500);
  }
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : "internal error" }, 500);
};
