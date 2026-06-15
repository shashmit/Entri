import { createClient, createAdminClient, type InsForgeClient } from "@insforge/sdk";
import { env } from "../config/env.js";

const baseUrl = env.INSFORGE_URL;
const anonKey = env.INSFORGE_ANON_KEY;
const apiKey = env.INSFORGE_API_KEY;

/**
 * Per-request client scoped to the caller's InsForge access token. Passed as
 * `edgeFunctionToken` (the documented serverless/JWT path) so the SDK uses the
 * bearer for every request and never tries to refresh — refresh tokens live in
 * the SPA, not here. Every DB call runs as `authenticated`, so RLS
 * (auth.uid() = user_id) is the tenant boundary, not the API code.
 */
export function userClient(accessToken: string): InsForgeClient {
  return createClient({ baseUrl, anonKey, edgeFunctionToken: accessToken });
}

/**
 * Project-admin client. Bypasses RLS — server-only, used for the seed script
 * and (later) the ingest worker's claim-then-isolate path. Never per-user.
 */
export const admin: InsForgeClient = createAdminClient({ baseUrl, apiKey });
