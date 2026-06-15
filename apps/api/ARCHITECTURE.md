# entri API — architecture & conventions

A small [Hono](https://hono.dev) HTTP API on Node, organized in layers. The rule
of thumb: **routes are thin, services hold the logic, `lib/` wraps external
systems, and nothing reaches for `process.env` except `config/`.**

## Folder map

```
src/
├─ index.ts          Bootstrap: validate env, bind the port, start the worker.
├─ app.ts            Hono app assembly: global middleware, route mounts, error boundary.
├─ config/
│  └─ env.ts         The ONLY reader of process.env. Zod-validated, parsed once at startup.
├─ middleware/
│  ├─ auth.ts        requireAuth + the AppEnv type (userId + RLS-scoped db on the context).
│  └─ error.ts       app.onError boundary — maps InsForge errors to their HTTP status.
├─ lib/              External integrations (clients), one file per system.
│  ├─ insforge.ts    userClient() (RLS-scoped) + admin (RLS-bypassing, server-only).
│  ├─ ai.ts          OpenRouter (chat) + Cloudflare (embeddings) via the Vercel AI SDK.
│  └─ sarvam.ts      Sarvam Vision OCR client.
├─ services/         Business logic. No HTTP, no req/res — plain functions.
│  ├─ extract.ts     OCR text → structured flashcards (Output.object schema).
│  ├─ graph.ts       Concept-graph write (extract/persist) + read (assembleGraph).
│  ├─ fsrs.ts        Spaced-repetition scheduling (ts-fsrs wrapper).
│  └─ ingest-worker.ts  In-process queue: claims jobs, runs OCR→cards→embeddings→graph.
├─ routes/           HTTP layer. One Hono sub-app per resource, mounted in app.ts.
└─ utils/
   └─ index.ts       Tiny pure helpers (orThrow, formatInterval). No app imports.
```

## Dependency direction

`routes → services → lib → config`. Keep it one-way:

- **routes** parse/validate the request, call services or the SDK, shape the response. Keep them thin — no extraction/scheduling/graph math inline.
- **services** are pure logic: plain functions, no Hono `Context`. Reusable across routes and the worker.
- **lib** is the only place that constructs external clients.
- **config/env.ts** is the only module that reads `process.env`. Import `env` from it everywhere else.
- **utils** stay dependency-free (no imports from app code) so anything can use them.

## Conventions

- **SDK results are `{ data, error }`** (they don't throw). Use `orThrow(...)` from
  `utils` to keep handlers linear, or check `error` explicitly. The AI SDK is the
  exception — it *throws*; catch those separately.
- **RLS is the tenant boundary, not the API code.** Routes use `c.get("db")` — a
  client scoped to the caller's token, so every query runs as `authenticated` and
  RLS filters to their rows. The `admin` client in `lib/insforge.ts` bypasses RLS;
  use it only server-side (the worker) and always scope queries by `userId`.
- **Database inserts take an array**: `insert([{ ... }])`.
- **AI is lazy and degrades.** `lib/ai.ts` / `lib/sarvam.ts` expose `*Configured()`
  guards; routes return `503` when creds are missing rather than crashing. Required
  vs optional env is declared in `config/env.ts`.
- **Imports use the `.js` extension** (NodeNext ESM), even for `.ts` sources.
- **Errors bubble to `app.onError`** (`middleware/error.ts`); don't try/catch just to
  return a 500.

## Adding things

- **A route**: create `routes/<name>.ts` exporting `export const <name> = new Hono<AppEnv>()`,
  then mount it in `app.ts` (under `/v1` for authed, or top-level for public).
- **Business logic**: add a function in the relevant `services/*.ts`; call it from the
  route. Don't inline it in the handler.
- **A new external system**: add a client in `lib/`, gated by a `*Configured()` check,
  reading its creds from `config/env.ts`.
- **A CLI script** (e.g. a seed/backfill): put it in `src/scripts/` and point a
  `package.json` script at it. (Note: the `seed` / `backfill-graph` scripts in
  `package.json` currently reference files that don't exist yet.)
```
