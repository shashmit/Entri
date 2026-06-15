import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createWorkersAI } from "workers-ai-provider";
import { env } from "../config/env.js";

// AI layer = Vercel AI SDK, split across two gateways by capability:
//   - chat: DeepSeek V4 Flash via InsForge's OpenRouter gateway. Powers grounded
//     RAG answers (chat.ts), OCR→card structuring (extract.ts), and concept-graph
//     extraction (graph.ts).
//   - embed: Cloudflare Workers AI bge-large → 1024-dim, which keeps the existing
//     vector(1024) schema (and the stored embeddings) intact.
//   - Sarvam: handwriting OCR only (see sarvam.ts, its own client — not the AI
//     SDK). Its OCR text is structured by the chat model above.
//
// Chat model overridable via OPENROUTER_CHAT_MODEL. Keep OPENROUTER_API_KEY and
// the Cloudflare creds server-side only — never a NEXT_PUBLIC_/VITE_ var.
// Lazy throughout: a missing key only degrades the dependent routes.

export const MODELS = {
  chat: env.OPENROUTER_CHAT_MODEL || "deepseek/deepseek-v4-flash", // OpenRouter
  embed: "@cf/baai/bge-large-en-v1.5", // Cloudflare — 1024-dim
} as const;

export const EMBED_MODEL = MODELS.embed;

// ---- OpenRouter (chat / text generation) ----
export function chatConfigured(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
function openrouter() {
  if (!chatConfigured()) {
    throw new Error("OpenRouter AI not configured: set OPENROUTER_API_KEY");
  }
  if (!_openrouter) {
    _openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY!, appName: "entri" });
  }
  return _openrouter;
}

// extract.ts/graph.ts ask for JSON via Output.object. `require_parameters` pins
// OpenRouter routing to upstreams that actually honor the json_schema response
// format — DeepSeek V4 Flash supports structured outputs on Fireworks/DeepInfra/
// etc. but not on every route, so without this it silently falls back to
// prompt-coaxed JSON. response-healing repairs any malformed JSON as a backstop.
export const chatModel = () =>
  openrouter()(MODELS.chat, {
    provider: { require_parameters: true },
    plugins: [{ id: "response-healing" }],
  });

// ---- Cloudflare Workers AI (embeddings) ----
export function embedConfigured(): boolean {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);
}

let _cf: ReturnType<typeof createWorkersAI> | null = null;
function cf() {
  if (!embedConfigured()) {
    throw new Error("Cloudflare AI not configured: set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN");
  }
  if (!_cf) {
    _cf = createWorkersAI({
      accountId: env.CLOUDFLARE_ACCOUNT_ID!,
      apiKey: env.CLOUDFLARE_API_TOKEN!,
    });
  }
  return _cf;
}

// AI SDK v6 renamed the provider method textEmbedding → embedding (textEmbedding
// is kept as a deprecated alias). Use the current name.
export const embedModel = () => cf().embedding(MODELS.embed);

// ---- Combined readiness ----
/** Both gateways ready: OpenRouter (chat) + Cloudflare (embeddings) — the full RAG stack. */
export function aiConfigured(): boolean {
  return chatConfigured() && embedConfigured();
}

// ---- Sarvam (extraction OCR only — see sarvam.ts for its client) ----
export function extractionConfigured(): boolean {
  return Boolean(env.SARVAM_API_KEY);
}
