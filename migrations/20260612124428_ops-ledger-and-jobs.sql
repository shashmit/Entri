-- entri ops: retention analytics, the LLM cost ledger (spend-cap source of
-- truth), and the ingest/pipeline jobs queue. PLAN.md M0 (ledger wired from
-- the first LLM call), M1 (jobs retry/backoff/dead state), M4 (spend cap).

-- ---------------------------------------------------------------------------
-- events: append-only retention/analytics stream (D1/D7/D30, set-completion).
-- Never report "cards generated" as success — these are the real signals.
-- ---------------------------------------------------------------------------
CREATE TABLE public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  props       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- llm_usage: append-only cost ledger. The per-user monthly spend cap is
-- SUM(usd) over the current month; cache_read_input_tokens proves prompt
-- caching is live (M5 check).
-- ---------------------------------------------------------------------------
CREATE TABLE public.llm_usage (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,              -- ingest | embed | infer | question_gen | grade | chat
  model              TEXT NOT NULL,
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
  usd                NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- jobs: the pipeline queue. Drained server-side (project_admin / service key,
-- bypassing RLS) with the claim-then-isolate pattern: claim across tenants on
-- a minimal path, then scope work to job.user_id. Clients only read their own
-- job status; all writes are server-side. attempts/max_attempts + run_after
-- give retry-with-backoff and a terminal 'dead' state. PLAN.md M1.
-- ---------------------------------------------------------------------------
CREATE TABLE public.jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                    -- ingest | embed | infer | question_gen | reminder
  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'claimed', 'running', 'done', 'failed', 'dead')),
  payload      JSONB NOT NULL DEFAULT '{}',
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error   TEXT,
  run_after    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================ indexes ====================================
CREATE INDEX events_user_id_idx     ON public.events (user_id, created_at);
CREATE INDEX llm_usage_user_id_idx  ON public.llm_usage (user_id, created_at);    -- monthly SUM(usd)
CREATE INDEX jobs_user_id_idx       ON public.jobs (user_id);
-- Drain loop: claim the oldest runnable queued job (FOR UPDATE SKIP LOCKED).
CREATE INDEX jobs_drain_idx         ON public.jobs (run_after) WHERE status = 'queued';

-- ============================ RLS + grants ===============================
ALTER TABLE public.events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs      ENABLE ROW LEVEL SECURITY;

-- events: append-only, owner read + insert.
CREATE POLICY "own events read" ON public.events
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own events insert" ON public.events
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT ON public.events TO authenticated;
REVOKE UPDATE, DELETE ON public.events FROM authenticated;

-- llm_usage: append-only ledger, owner read + insert (server stamps rows).
CREATE POLICY "own llm_usage read" ON public.llm_usage
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own llm_usage insert" ON public.llm_usage
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT ON public.llm_usage TO authenticated;
REVOKE UPDATE, DELETE ON public.llm_usage FROM authenticated;

-- jobs: clients read their own status only; the queue is written server-side
-- (project_admin bypasses RLS), so no client INSERT/UPDATE/DELETE.
CREATE POLICY "own jobs read" ON public.jobs
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.jobs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.jobs FROM anon, authenticated;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
