import { z } from "zod";

// Single validated source of truth for process.env. Parsed once at startup so a
// misconfigured deploy fails fast and loudly here, not deep inside a request.
//
// Core InsForge creds are required. AI/OCR creds are OPTIONAL by design: the API
// boots without them and the dependent routes degrade (the *Configured() guards
// in lib/ai.ts and lib/sarvam.ts gate capture/chat behind a 503). Read config
// through this `env` object — do not reach for process.env elsewhere.
const schema = z.object({
  // InsForge backend (required).
  INSFORGE_URL: z.string().min(1),
  INSFORGE_ANON_KEY: z.string().min(1),
  INSFORGE_API_KEY: z.string().min(1),

  // Server.
  PORT: z.coerce.number().default(8787),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),

  // Platform. VERCEL is "1" on Vercel — used to skip the port bind + in-process
  // worker (serverless has no long-running process; we drain via cron instead).
  // CRON_SECRET guards POST /internal/drain; Vercel Cron sends it as a bearer.
  VERCEL: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  // OpenRouter — chat / text generation (optional).
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_CHAT_MODEL: z.string().optional(),

  // Cloudflare Workers AI — embeddings (optional).
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  // Sarvam — handwriting OCR (optional).
  SARVAM_API_KEY: z.string().optional(),
  SARVAM_OCR_LANGUAGE: z.string().default("en-IN"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment (see apps/api/.env.example):\n${issues}`);
}

export const env = parsed.data;
