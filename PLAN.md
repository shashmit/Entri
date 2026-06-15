---
status: ACTIVE
---
> ## ⚠️ Build update — 2026-06-14: AI provider stack + as-built architecture (OVERRIDES model strategy + tenancy mechanics below)
>
> This banner reflects what is actually built and running on localhost. It supersedes the locked
> model strategy (Claude+Voyage direct) and the `SET LOCAL` tenancy mechanics wherever they conflict.
> Product scope, FSRS, trust UX, and the InsForge platform choice are UNCHANGED.
>
> **AI provider stack (final).** The LLM layer is the **Vercel AI SDK** (`ai`@6). Two providers, split by capability:
>
> | Job | Provider | Model | Notes |
> |---|---|---|---|
> | Handwriting extraction — **step 1 OCR** | **Sarvam Vision** (Document Intelligence) | `documentIntelligence` job (`sarvamai` SDK) | Async job; input is **one PDF OR a ZIP of images**, output is a **ZIP of per-page Markdown**. Verbatim transcription only. SOTA Indic OCR + handwriting. |
> | Handwriting extraction — **step 2 structure** | **Sarvam** | `sarvam-30b` | OCR text → Q/A cards + **flagged** corrections. Rides Sarvam's **OpenAI-compatible** `/v1/chat/completions` via `@ai-sdk/openai-compatible`. |
> | Embeddings | **Cloudflare Workers AI** (REST) | `@cf/baai/bge-large-en-v1.5` | **1024-dim → keeps the locked `vector(1024)` schema; Voyage DROPPED.** |
> | RAG chat | **Cloudflare Workers AI** (REST) | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | grounded answers; ≥2-chunk gate + 1-strong-chunk degrade. |
>
> Why this and not the locked Claude+Voyage: vision provider was chosen by elimination — Cloudflare's own vision
> model is Llama-license-gated (EU-domicile clause), LLaVA too weak; we tried Anthropic then OpenAI/gpt-5.2, and
> the user chose **Sarvam** for best Indic + handwriting OCR. Sarvam Vision is **OCR, not a promptable vision LLM**
> and is not on the chat endpoint → extraction is the 2-step OCR→structure above. The InsForge AI gateway
> (OpenRouter) remains a deferred, opt-in consolidation. The locked "never silently correct" trust property is
> preserved because **OCR is verbatim** and only the structuring step flags corrections.
>
> **As-built compute/tenancy (differs from the locked Cloudflare/`SET LOCAL` plan — revisit at deploy):**
> - **API:** a **standalone Hono app** (`/api`, Node + `@hono/node-server`, localhost:8787) — NOT Cloudflare Workers yet. Portable to Workers later.
> - **Tenancy/RLS:** **InsForge-native `auth.uid()` RLS** on every table, NOT the `SET LOCAL app.user_id` + NOBYPASSRLS model. The SPA owns auth (InsForge SDK); the Hono API verifies the InsForge JWT (decodes `sub`) and makes RLS-scoped calls via the SDK's `edgeFunctionToken` path. RLS is the defense-in-depth backstop; the API still holds the server-side gates.
> - **Ingest worker:** an **in-process drain loop** over the Postgres `jobs` table (claim → process → retry/backoff/dead), started inside the API process — NOT Cloudflare Workflows/Queues yet. Same claim-then-isolate semantics; becomes a Workflow consumer at deploy.
>
> **Capture data flow (incl. PDF — added 2026-06-14):** browser → `POST /v1/capture` (base64) → **upload bytes to InsForge Storage** (private bucket `note-images`, server-minted key `<userId>/<noteId>/<i>.{jpg|png|pdf}`) → insert `notes`+`images` rows → enqueue an `ingest` job (returns `noteId` fast). The worker then **downloads the bytes back from InsForge Storage** → Sarvam OCR (images zipped into one job; **each PDF uploaded directly** since Sarvam takes one PDF *or* one image-ZIP per job) → `sarvam-30b` structuring → Cloudflare embeddings → `items`/`card_srs`/`embeddings`/`corrections`. So **InsForge is the durable store first; the worker re-reads and ships to the AI tools.** Image/PDF bytes leave to Sarvam (OCR); only text leaves to Cloudflare. UI + endpoint accept `image/*` and `application/pdf`.
>
> **Env (`api/.env`):** `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (set, verified), `SARVAM_API_KEY` (+ optional `SARVAM_OCR_LANGUAGE`, default `en-IN`) — **the one remaining blocker to run capture end-to-end**. Lazy config: missing creds only 503 the dependent routes.
>
> **Verified working:** auth + all CRUD/read endpoints, FSRS review loop, readiness, the frontend (today/notes/readiness/review/settings/capture/chat wired off the API, `lib/mock.ts` unused), Cloudflare embeddings (1024-dim) + the chat embed→`match_items`→grounding-gate path. **Not yet run:** capture→OCR→structure (pending `SARVAM_API_KEY`).
>
> **Still open / deferred:** raw-image **retention** (currently KEEP originals after extract; privacy-first alt = delete-on-extract — blocking decision #5, undecided); repo structure (`api/`,`migrations/`,`.insforge/` live at repo root which is NOT a git repo — only `web/` is); deferred AI features: inferred-fact generation, free-text grading, spend cap, post-stream citation validation, cloze generation.
>
> ---
>
> ## ⚠️ Infra update — 2026-06-11: InsForge full-platform (OVERRIDES locked infra below)
>
> The user adopted **InsForge** (open-source, agent-native backend) as the **full backend platform**.
> This supersedes the eng-chosen infra wherever they conflict. Compute, model strategy, tenancy
> *semantics*, and all product scope are UNCHANGED. Mapping:
>
> | Locked component | Now | Notes |
> |---|---|---|
> | Self-managed Postgres 16 + pgvector (Fly) | **InsForge Postgres + pgvector** | pgvector ships on every project; HNSW + cosine confirmed → Voyage `vector(1024)` plan intact. |
> | **Better Auth** (auth + tenant key) | **InsForge auth** (JWT + email/pw v1, OAuth later) | DROPPED Better Auth. Tenant key = InsForge user id (**UUID** — removes the old text-vs-uuid wrinkle). JWT verified in Hono middleware → `user.id` feeds `SET LOCAL app.user_id`. |
> | **Cloudflare R2** (image blobs) | **InsForge storage** (S3-compatible buckets) | DROPPED R2. Server mints scoped object keys; presigned upload; storage RLS for per-user isolation. Account-delete purges objects (M5 check unchanged, retargeted at InsForge storage). |
> | Claude via Vercel AI SDK + Voyage embeddings | **UNCHANGED for v1** | InsForge AI gateway is OpenRouter-based and lacks Voyage; adopting it would break the locked Sonnet→Opus escalation, prompt-caching, `llm_usage` ledger, and 1024d embeddings. Keep Claude+Voyage **direct**. Routing Claude through the InsForge gateway later (unified billing) is a DEFERRED, opt-in consolidation, not v1. |
> | ~~Fly.io (web + worker), Fly scheduled Machine~~ | **Cloudflare + InsForge (Fly DROPPED)** | Direction, not yet locked (deploy deferred — dev runs on **localhost**: `wrangler dev` + local/cloud InsForge). Mapping below. The long-ingest constraint that killed Vercel still holds, so a plain Worker is NOT the answer for ingest. |
>
> **Tenancy model preserved.** Self-hosting/local InsForge exposes a **direct Postgres connection with
> role + DDL control**, so the locked security model is built unchanged ON InsForge's Postgres: our own
> migrations, a `NOBYPASSRLS` app role, RLS on every table via `withTenantTx` (`SET LOCAL app.user_id`),
> the worker's claim-then-isolate path, the startup superuser assert, and the isolation test gating chat.
> **The SPA does NOT use InsForge's auto-REST/PostgREST for tenant data** — all tenant reads/writes go
> through the Hono API so the server-side gates (≥2-chunk grounding, post-stream citation validation,
> spend cap, clamp-to-gentler grading) are enforced. InsForge's SDK/auto-API is used only for **auth
> flows** and **presigned storage uploads**. RLS is the defense-in-depth backstop, not the API surface.
>
> **Compute mapping (Cloudflare, leaning — confirm at deploy):**
> - **API:** Hono runs natively on **Cloudflare Workers** — the request/response API surface, fine within CPU limits.
> - **Long vision ingest (~60s/image) + the `jobs` pipeline:** **Cloudflare Workflows** (durable multi-step
>   execution w/ retries + backoff, built for exactly this) or **Queues + consumer Worker**. This replaces the
>   Postgres `jobs` table drained `FOR UPDATE SKIP LOCKED` — OR keep that Postgres queue and just run the drain
>   as a Workflow/Queue consumer (keeps the queue co-located w/ tenant data + RLS; decide at build). Either way
>   the claim-then-isolate + retry/`max_attempts`/dead-state semantics from M1 are preserved.
> - **~20-min scheduled reconciler (M2) + reminders (M6):** **Cloudflare Cron Triggers** replace the Fly
>   scheduled Machine. The idempotent `UNIQUE(user_id, local_date)` self-heal on a missed tick is unchanged.
> - **Postgres connection from Workers:** Workers can't hold a raw long-lived PG socket, but the `SET LOCAL
>   app.user_id` per-transaction RLS model needs a real transaction — use **Cloudflare Hyperdrive** (pooled PG
>   w/ transaction support) against InsForge's Postgres, or InsForge's SDK. **This is the main thing to verify**:
>   that the chosen path supports `BEGIN; SET LOCAL …; …; COMMIT` so `withTenantTx` works unchanged. If not,
>   the ingest/worker tier runs as a long-lived process (Cloudflare Container or any host) instead of a Worker.
> - **Push delivery (M6 web push / VAPID):** a Worker, no change.
>
> **Open at build time:** confirm the local/self-hosted InsForge Postgres permits creating a
> `NOBYPASSRLS` role + custom RLS DDL (expected yes for self-host); decide whether app `user_id` FKs
> reference InsForge's `auth` user table directly or a mirrored `profiles` row; confirm Hyperdrive (or
> SDK) preserves the `SET LOCAL` transaction model, else run ingest as a long-lived container. Skills
> available: `insforge`, `insforge-cli`, `insforge-integrations`, `insforge-debug`.

# CEO Plan: AI Study-Notes App (capture → FSRS review → grounded chat)
Generated by /plan-ceo-review on 2026-06-06
Branch: (no git repo yet) | Mode: SELECTIVE EXPANSION
Repo: local /Users/shashmit/Drai/entri (greenfield)
Stack (fixed by user): Hono (TS) + Postgres/pgvector + Vercel AI SDK + Claude. Embeddings via Voyage.
Infra: **InsForge full-platform** (Postgres+pgvector, auth, storage) + **Cloudflare** compute (Workers/Workflows/Cron) per the 2026-06-11 update banner above — supersedes the original eng-chosen infra (was: Fly.io web+worker, Cloudflare R2, Better Auth). **Fly DROPPED.** Dev runs on localhost; ts-fsrs unchanged.

## Vision

### 10x check
The version that wins is not "photo → flashcards" (commoditized). It is the app a student opens
every single day without being nagged, that they trust completely because every AI-generated card
and fact links back to their own handwriting, and that schedules itself around their actual exam
date so mastery peaks the week it matters. The 10x is in habit + trust, not feature count.

### Platonic ideal
A personal exam coach built from your own messy notes: it reads your handwriting, never silently
"fixes" it, quizzes you on a forgetting curve tuned to your exam date, explains every miss from
your own material, and shows you a believable "exam readiness %." Retention and trust are the
product; the four AI pipelines are plumbing.

## Landscape (why this review pushed on retention + trust)
- StudyFetch already ships the exact spec: photo of handwritten notes → transcribe → flashcards +
  quizzes + an AI tutor grounded in your content. Knowt and Laxu AI are close. Feature parity is
  table stakes, not a moat.
- Under 16% of flashcard-app downloaders are active after week one; most delete within three weeks.
  The science works; the apps fail on habit and on feeling like a chore.
- Edge already chosen correctly: FSRS (Anki/RemNote use it and beat StudyFetch/Knowt/Quizlet's
  weaker schedulers). Keep it.

## Strategic decisions
- **Approach (D1): Full spec, horizontal.** User chose B over the wedge-first recommendation.
  Committed. The review's job became "make the full build win on retention + trust," not shrink it.
- **Mode (D2): SELECTIVE EXPANSION.** Full spec is the locked baseline; expansions cherry-picked.

## Scope decisions (expansions over the base spec)

| # | Proposal | Effort (human/CC) | Decision | Reasoning |
|---|----------|-------------------|----------|-----------|
| E1 | Exam-date-aware FSRS scheduling | 3-4d / ~0.5d | ACCEPTED | Cheap, defensible edge over generic FSRS; speaks to the panicked-before-exam user |
| E2 | Streaks + smart reminders (push/email) | ~1wk / 1-2d | ACCEPTED | The retention lever; retention is the whole game here |
| E3 | Trust UX: source provenance + AI-inferred separation | 3-5d / ~1d | ACCEPTED | Half the reason-to-exist; de-risks memorizing a hallucination |
| E4 | Failed-review → targeted chat micro-explanation | 3-4d / ~0.5d | ACCEPTED | Gives the chatbot a job in the daily loop; connects two pillars |
| E5 | Exam-readiness / weak-spot dashboard | 4-5d / ~1d | ACCEPTED | Motivation surface; shows outcome, not the vanity "cards generated" proxy |
| E8 | Multi-page batch capture | 3-4d / ~0.5d | ACCEPTED | Matches real behavior (photograph a whole notebook), small cost |
| E7 | Shared / community decks | 2-3wk / 3-4d | DEFERRED | Platform play; fights "your own notes" premise; needs a vertical first |
| E6 | Separate confidence rating feeding FSRS | 2-3d / ~0.5d | SKIPPED | Redundant with FSRS Again/Hard/Good/Easy grades; adds per-card friction |

## Accepted v1 scope
- Base spec: photo capture → Claude vision extraction + flagged corrections → Postgres → FSRS daily
  exam (in-app) → hidden facts (inferred + cloze) → per-user grounded RAG chat. Multi-user + auth.
- Plus: E1 exam-date scheduling, E2 streaks + reminders, E3 trust/provenance UX, E4 fail→explain,
  E5 readiness dashboard, E8 batch capture.

## Deferred to TODOS
- E7 community/shared decks (revisit when a vertical concentrates users)
- Cross-note connections graph (the "hidden facts (c)" path — eng deferred it as riskiest/most
  expensive; RAG covers "related material" for v1)
- Hybrid RRF + FTS retrieval. v1 serves cosine top-k via the **HNSW** index on the `vector` column; a
  GIN index on `fts` is pre-shipped for the deferred FTS/fusion path and is unused in v1.
- Per-user FSRS weight optimization (collect review_log from day one, re-fit later)
- Shared/multi-user workspaces (v1 is user==tenant)
- Embedding dimension-change migration: `embed_model` is stored per row and filtered in every
  retrieval, so a future model swap adds a parallel column + per-model HNSW index and backfills
  (strategy documented in the eng synthesis; not built, and nothing in v1 references it)
- Horizontal worker pool / external queue

## Skipped
- E6 separate confidence rating (FSRS grades already encode it)

## Architecture (from eng-synthesis workflow: 11 agents, 43 risks, 24 critical resolved)
Full synthesis on file. Headlines:
- **Runtime:** see the 2026-06-11 banner — **Cloudflare** (Workers API + Workflows/Queues for long ingest
  + Cron Triggers for the ~20-min scheduler) on **InsForge** Postgres+pgvector, Next.js SPA. ~~Fly.io~~ DROPPED.
  NOT a plain short-lived function for ingest (the constraint that ruled out Vercel). The `jobs` queue
  (`FOR UPDATE SKIP LOCKED`) is either kept in Postgres and drained by a Workflow/Queue consumer, or replaced
  by Cloudflare Queues — decided at build (banner has the mapping).
- **Tenancy:** `user_id` is the only tenant key. RLS armed on every table via `withTenantTx`
  (`SET LOCAL app.user_id`) on every request AND every worker job. Claim-vs-isolate resolution: the
  worker claims jobs on a minimal-privilege path that sees only the `jobs` table across tenants
  (`FOR UPDATE SKIP LOCKED`), then reads `job.user_id` and runs `SET LOCAL app.user_id` for the
  transaction doing the actual work — so cross-tenant claim and per-job isolation don't conflict. App
  role is NOBYPASSRLS with a startup assert and an isolation test that must pass before chat ships. The
  tenant key is Better Auth's `user.id`; Better Auth's own tables (`user`, `session`, `account`,
  `verification`) are NOT under the tenant RLS policy and are read via Better Auth's own DB connection,
  since session lookup happens before tenant scoping.
- **Schema:** one `items` table (kind discriminates; carries a `topic`/`tags` field that E5's
  weak-spot view groups on — topics come from the vision pass, not a separate taxonomy in v1), one
  `embeddings` table (real FK, `vector(1024)` for Voyage voyage-3-large), first-class `corrections`,
  `card_srs`/`srs_params`/`review_log`, `daily_set`, an `events` table (retention analytics), and the
  `llm_usage` ledger. Better Auth owns `user`/`session`/`account`/`verification`, and every app table's
  `user_id` references `user.id`. Better Auth ids are `text` by default, so the tenant key and
  `current_user_id()` are `text` (drop the uuid cast); alternatively configure Better Auth to emit UUIDs.
- **Pipelines + models:** ingest `generateObject` on Sonnet 4.6, escalating to Opus 4.8 on an
  **objective** trigger (a `generateObject` schema-validation failure or correction-count above a set
  threshold — never self-reported confidence). Cloze = no LLM (deterministic span masking). Inferred
  facts on Sonnet, then a **Haiku entailment check** (returns `supported|unsupported|contradicts`
  against cited texts; anything not `supported` is discarded) plus a **confidence floor of ≥0.6**;
  survivors stored `review_status='pending'`. Question-gen is LAZY + cached on Sonnet; MCQ/cloze graded
  deterministically at $0; free-text judged by Haiku with **clamp-to-gentler** (on a low-confidence
  verdict, apply the gentler FSRS rating — Hard not Again — so judge noise can't trigger spurious
  lapses). RAG is retrieve-then-generate (no model-callable tool) on Sonnet, with a ≥2-chunk grounding
  gate and post-stream citation validation.
- **Cost:** the ~$1.70/user/mo bottom-up figure is the BASE pipelines only. Reconciled with the
  accepted expansions, the band is **~$2-4/user/mo**: E4 (every failed review → a grounded chat
  micro-explanation) is the main heavy-tail driver and scales with struggling users, who are exactly
  the panicked-before-exam persona; E2 reminders and E5 readiness are near-zero LLM. The pre-flight
  spend cap (sum of `llm_usage.usd`) bounds the worst case; **default ceiling for M4 if undecided:
  $6/user/mo hard cap, hard-stop ingest + degrade (not cut) chat.**

## Expansion deltas (how E1-E5, E8 change the base architecture)
- **E1 exam-date:** add `srs_params.exam_date` (a single per-user date in v1 — there are NO decks in
  v1; deck grouping rides with deferred E7). A scheduling layer over ts-fsrs raises desired-retention /
  compresses intervals as the date nears; the daily-set reconciler reads it.
- **E2 streaks + reminders:** add `streaks` state + a `reminder` job type; a **Cloudflare Cron Trigger**
  (replacing the Fly scheduled Machine) enqueues reminders; needs a delivery channel (web push and/or email). Heaviest expansion.
- **E3 trust/provenance:** mostly SUPPORTED already (`source_quote`, `span_meta`, `images.blob_key`,
  `origin`, first-class `corrections`). `span_meta` stores character offsets into `items.body` (also
  used by cloze). v1 provenance links each card to its source note + `source_quote` (text-level "this
  came from here"); pixel-region highlight on the original image is best-effort, only if the vision
  pass returns layout boxes, otherwise deferred. Adds the UI: tap-to-source, distinct styling for
  `origin='inferred'`, corrections shown as suggestions never silent edits. If blocking-decision #5
  chooses delete-on-extract, the pixel-region highlight is dropped and provenance stays text-level.
- **E4 fail→explain:** on `review_log.rating = Again`, offer a chat micro-explanation seeded from that
  item; new endpoint/flow bridging the exam session and the RAG chat (both already exist).
- **E5 readiness dashboard:** `GET /v1/readiness` aggregates `card_srs` + `review_log`. Readiness % =
  mean predicted FSRS retrievability across the user's active cards evaluated at `exam_date` (cards
  weighted equally in v1), bucketed by `items.topic` for the weak-spot list. review_log exists from
  day one, so this needs no new capture. Computation = decay from each card's current FSRS stability
  to `exam_date` assuming no further reviews (a conservative "if you stopped studying now" reading),
  computed directly from stored stability with no future-review simulation.
- **E8 batch capture:** multi-image presigned upload + group N images into one note/processing set;
  `images` + `jobs` already support it.

## Top risks (resolved by the red-team unless noted)
- Schema/embedding/tenancy incompatibility → one schema, one items + one embeddings table, user_id everywhere.
- RLS silently inert → per-tx/per-job SET LOCAL, NOBYPASSRLS, isolation test gates chat.
- "Memorize a hallucination" → inferred facts pending + never auto-enrolled + labeled "AI-inferred".
- Client-supplied blobKey cross-tenant read → server mints key; presigned PUT scoped; re-verified.
- Cost blowout → Sonnet-default, lazy gen, MCQ/cloze-first, Haiku judge, enforced spend cap.
- FSRS timezone/DST → IANA enforced, DST-aware convergent reconciler, ts-fsrs pinned.

## Phased build plan (each milestone is a vertical slice with a verifiable check)
- **M0** Skeleton + tenant boundary + **working auth**. Signup/login/session, **IANA-timezone capture
  at signup** (blocking decision #3), `withTenantTx`, NOBYPASSRLS app role, `jobs` table + drain loop,
  and `llm_usage` ledger writes wired from the first LLM call. ✅ signup/login works; a WHERE-less
  query run as the app role returns zero cross-tenant rows; startup asserts `is_superuser='off'`.
  Auth = **Better Auth**: mounted at `/api/auth/*` via `auth.handler`; a Hono middleware sets the user from
  `auth.api.getSession({ headers })`, and `withTenantTx` reads `user.id` for `SET LOCAL app.user_id`.
  Email+password in v1; OAuth/magic-link are Better Auth plugins enabled when needed; Better Auth tables stay outside tenant RLS.
- **M1** Capture → extract → see notes (E8 batch capture lands here). Cloze cards are generated here
  (deterministic masking on extracted items) so M2 has cards to review. Jobs retry with backoff
  (`attempts`/`max_attempts`) and a terminal dead state. ✅ a real handwritten photo → `extracted` in
  ~60s **per image** (a batch SLA scales with page count, not ~60s total); an unreadable/non-notes
  image → user-visible `failed` state, not a stuck job; a deliberate silent-rewrite test row is
  flagged, not stored. Ingest enqueues an embed job (Voyage) that stamps `embed_model` on every
  embedding row (so the documented future model-swap migration stays valid).
- **M2** Daily exam loop end-to-end + **E1 exam-date scheduling**. Reconciler: compute each user's
  `local_date` from their stored IANA zone (DST-aware lib), select users past `study_hour_local` with
  no set for that `local_date`, insert set + items in one transaction; `UNIQUE(user_id, local_date)`
  makes it idempotent and a missed/late ~20-min tick self-heals next tick. Resubmit idempotency =
  `SELECT … FOR UPDATE` on `daily_set_item`. ✅ exactly one daily set per local date across
  spring-forward AND fall-back; answering updates `due` + writes review_log; resubmit returns the
  stored verdict (no double-apply). (This is where the product works.)
- **M3** Grounded chat + **E4 fail→explain hook**. The ≥2-chunk grounding gate degrades gracefully for
  sparse corpora (a new user with one short note): fall back to a single strong chunk above a higher
  floor rather than refusing answerable questions. ✅ in-notes question → cited answer; a short-corpus
  question still answers when one chunk is strongly relevant; off-topic → refusal; cross-user probe → empty.
- **M4** Hidden facts (a)+(b) + free-text grading + spend cap. ✅ inferred fact never in exam until
  accepted and labeled; unsupported inferred fact discarded; over-ceiling → 429.
- **M5** Hardening + **E3 trust UX** + **E5 readiness dashboard** (both have no external deps). ✅ accepting
  a correction changes the next question + retrieved chunk; account-delete leaves zero residual rows + R2
  objects; cache_read_input_tokens > 0; readiness % renders and the weak-spot list groups by topic.
- **M6** **E2 streaks + reminders** (split out: it's the heaviest expansion with an external dependency).
  Pick ONE delivery channel for v1 — web push via VAPID (email deferred); add `streaks` state + a
  `reminder` job type enqueued by the existing Cloudflare Cron Trigger. ✅ a reminder fires on a due-review
  schedule and a streak increments across consecutive days.

## Blocking decisions (must answer before/at the relevant milestone)
1. **Auth resolved: InsForge auth** (was Better Auth — superseded by the 2026-06-11 infra update). Email+password
   in v1, OAuth via InsForge providers later. Tenant key = InsForge user id (UUID). Hono middleware verifies the
   InsForge JWT and feeds `user.id` to `SET LOCAL app.user_id`. Remaining sub-decision: token transport for the
   SPA→Hono calls (Authorization: Bearer InsForge JWT, recommended for localhost + unrelated-origin dev) vs cookie
   topology if web+API are colocated under one domain in prod. — affects CORS (M0).
2. Per-user monthly spend ceiling + behavior at cap. Default if undecided: $6/user/mo, hard-stop ingest + degrade chat. — M4.
3. IANA timezone captured at signup (not a UTC offset)? — blocks the daily-set reconciler (M2).
4. Inferred-fact UX: confirm pending-by-default + accept-to-study (recommended) vs auto-enroll. — M4.
5. Raw image retention: delete R2 blob after successful extract (privacy default) vs keep for
   re-extraction. Consequence: delete-on-extract drops E3's pixel-region highlight (text-level
   provenance only); account deletion purges blobs either way. — decide before M3/M5.

## North stars from this CEO review (carry through every milestone)
- Differentiation is retention + trust, not features. **Targets:** D1/D7/D30 retention (beat the cited
  <16% week-one baseline; aim D7 > 30%), % of daily-active users who finish the daily set, and a
  optional self-reported post-exam result (the app has no silent ground truth, so exam outcome is
  opt-in, never inferred). Instrument via the `events` table. Never report "cards generated" as success.
- **Accepted strategic risk (#1):** the committed horizontal build has no named user segment, which is
  exactly the StudyFetch-parity / no-moat failure the landscape warns about. Mitigation: the retention +
  trust differentiators (E1-E5) are the moat substitute for v1; if D7 retention lags the target, pick a
  vertical wedge (the dir is named "entri," suggesting an exam-prep segment) before scaling spend.
- Never silently mutate a student's notes; corrections are suggestions they confirm.
- Use ts-fsrs; do not hand-roll the scheduler.
- The "who is this for?" premise question is now tracked as Accepted strategic risk #1 above, not left
  as an open aside.
