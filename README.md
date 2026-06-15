# entri

AI study-notes app: photograph handwritten notes → extraction that **never silently
corrects** (suspect values are surfaced as tentative corrections, not rewritten) →
an FSRS daily review tuned to your exam date → grounded RAG chat over your own notes.
Thesis: **retention + trust**.

- Product/eng plan and milestones: [`PLAN.md`](PLAN.md)
- Design system (read before any UI work): [`DESIGN.md`](DESIGN.md)

## Monorepo

This is a [Turborepo](https://turbo.build/repo) managed with **pnpm workspaces**.

```
apps/
  api/         Hono API + in-process ingest worker (Node, port 8787)
  web/         Next.js app (port 3000)
packages/      shared code (none yet)
migrations/    InsForge SQL migrations
insforge.toml  InsForge project config
PLAN.md        CEO/eng plan, milestones M0–M6
DESIGN.md      Design system (Marginalia, dialed back)
turbo.json     task pipeline   ·   pnpm-workspace.yaml
```

| Layer | Tech |
|-------|------|
| Web (`@entri/web`) | Next.js (React) — `apps/web`, port 3000 |
| API (`@entri/api`) | Hono on Node (`@hono/node-server`) — `apps/api`, port 8787 |
| Backend (DB, auth, storage) | [InsForge](https://insforge.dev) (Postgres + pgvector) |
| Extraction | Sarvam Vision OCR → card structuring on DeepSeek V4 Flash (OpenRouter) |
| RAG chat + concept graph | DeepSeek V4 Flash via OpenRouter (InsForge AI gateway) |
| Embeddings | Cloudflare Workers AI (`bge-large`, 1024-dim) |

The `apps/api` ingest worker is an in-process queue (polls the `jobs` table). It's slated
to become a Cloudflare Workflow/Queue later (see `apps/api/src/worker.ts`).

## Prerequisites

- Node 20+ and [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- An [InsForge](https://insforge.dev) project (free) — for DB/auth/storage
- *(Optional, for capture/chat)* an **OpenRouter** API key (the InsForge AI gateway, for
  the chat/text model), a Cloudflare account with a **Workers AI** API token (embeddings),
  and a **Sarvam** API key (OCR). Without these the app still runs: auth, UI, and browsing
  work; only photo capture (extraction) and chat are disabled.

## Setup

```bash
# 1. Install the whole monorepo (one command)
pnpm install

# 2. Configure environment
cp apps/api/.env.example apps/api/.env        # InsForge + (optional) Cloudflare/Sarvam keys
cp apps/web/.env.example apps/web/.env.local  # NEXT_PUBLIC_INSFORGE_* (anon key)

# 3. Set up the database (applies migrations/ to your InsForge project)
npx @insforge/cli link
npx @insforge/cli db migrations up --all

# 4. Run everything (Turbo runs api + web in parallel)
pnpm dev
```

- Web: http://localhost:3000   ·   API: http://localhost:8787

Open the web app, create an account, and you're in.

### Optional: seed a demo deck

```bash
# Find your user id from GET /v1/me after signing up, then:
pnpm seed -- <your-user-id>
```

## What runs without the AI keys

`apps/api/.env` gates the AI stack on `OPENROUTER_API_KEY` (chat/text) + `CLOUDFLARE_*`
(embeddings) + `SARVAM_API_KEY` (OCR). If those are unset:

- ✅ Auth, dashboard, notes browsing, settings, review of seeded cards — all work.
- ⚠️ `POST /v1/capture` returns `503 AI not configured`; the ingest worker logs `idle`.
- ⚠️ `/chat` returns `503` (needs OpenRouter for the chat model + Cloudflare for embeddings).

So you can boot the full UI with just an InsForge project, and add the AI keys later.

## Commands

Run from the repo root (Turbo fans out to the workspaces that define each task):

| Command | Does |
|---------|------|
| `pnpm dev` | api (watch) + web dev server, in parallel |
| `pnpm build` | production build (web) |
| `pnpm lint` | ESLint across workspaces |
| `pnpm typecheck` | `tsc --noEmit` across workspaces |
| `pnpm seed -- <userId>` | load the demo deck for a user |

Target one workspace with a filter, e.g. `pnpm --filter @entri/web dev` or
`pnpm --filter @entri/api typecheck`.
