import type { MiddlewareHandler } from "hono";
import type { InsForgeClient } from "@insforge/sdk";
import { userClient } from "../lib/insforge.js";

export type AppEnv = {
  Variables: {
    userId: string;
    db: InsForgeClient; // RLS-scoped to the caller
  };
};

// Read the `sub` claim (the user id) from an InsForge JWT without verifying the
// signature — identity only. InsForge verifies the signature on every DB call,
// and RLS WITH CHECK rejects any write that doesn't match, so a forged sub
// cannot read or write another user's rows.
function decodeSub(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, "base64url").toString()) as { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Require an InsForge access token (Authorization: Bearer ...). Stashes the
 * caller's id and an RLS-scoped client on the context. An invalid/expired token
 * passes here but fails at the first DB call (401/403), which the SPA refreshes
 * and retries.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return c.json({ error: "missing bearer token" }, 401);

  const userId = decodeSub(token);
  if (!userId) return c.json({ error: "invalid token" }, 401);

  c.set("userId", userId);
  c.set("db", userClient(token));
  await next();
};
