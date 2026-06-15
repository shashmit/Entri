-- entri M2: daily exam loop + exam-date scheduling (E1). FSRS state mirrors
-- the ts-fsrs Card/ReviewLog shapes (do not hand-roll the scheduler). The
-- daily set is idempotent per local date so a missed/late reconciler tick
-- self-heals. PLAN.md M2 + E1.

-- ---------------------------------------------------------------------------
-- card_srs: live FSRS state, one row per reviewable item (the card).
-- state: 0=New 1=Learning 2=Review 3=Relearning (ts-fsrs State enum).
-- ---------------------------------------------------------------------------
CREATE TABLE public.card_srs (
  item_id        UUID PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stability      DOUBLE PRECISION NOT NULL DEFAULT 0,
  difficulty     DOUBLE PRECISION NOT NULL DEFAULT 0,
  elapsed_days   INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  reps           INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  state          SMALLINT NOT NULL DEFAULT 0 CHECK (state BETWEEN 0 AND 3),
  last_review    TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- review_log: append-only history (also the raw material for E5 readiness and
-- the deferred per-user weight re-fit). No client UPDATE/DELETE.
-- ---------------------------------------------------------------------------
CREATE TABLE public.review_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id           UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),  -- Again/Hard/Good/Easy
  state             SMALLINT NOT NULL CHECK (state BETWEEN 0 AND 3),
  due               TIMESTAMPTZ NOT NULL,
  stability         DOUBLE PRECISION NOT NULL,
  difficulty        DOUBLE PRECISION NOT NULL,
  elapsed_days      INTEGER NOT NULL,
  last_elapsed_days INTEGER NOT NULL,
  scheduled_days    INTEGER NOT NULL,
  reviewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- daily_set: one set per user per local date. UNIQUE makes the ~20-min
-- reconciler tick idempotent across spring-forward / fall-back.
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_set (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date  DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, local_date)
);

-- ---------------------------------------------------------------------------
-- daily_set_item: the cards in a set. UNIQUE prevents dupes; rating recorded
-- on completion (resubmit idempotency handled by the API via FOR UPDATE).
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_set_item (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_set_id  UUID NOT NULL REFERENCES public.daily_set(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL DEFAULT 0,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  rating        SMALLINT CHECK (rating BETWEEN 1 AND 4),
  UNIQUE (daily_set_id, item_id)
);

-- ============================ indexes ====================================
CREATE INDEX card_srs_user_id_idx        ON public.card_srs (user_id);
CREATE INDEX card_srs_due_idx            ON public.card_srs (user_id, due);        -- "what's due today"
CREATE INDEX review_log_user_id_idx      ON public.review_log (user_id);
CREATE INDEX review_log_item_id_idx      ON public.review_log (item_id);
CREATE INDEX daily_set_user_id_idx       ON public.daily_set (user_id);
CREATE INDEX daily_set_item_user_id_idx  ON public.daily_set_item (user_id);
CREATE INDEX daily_set_item_set_idx      ON public.daily_set_item (daily_set_id);

-- ============================ RLS + grants ===============================
ALTER TABLE public.card_srs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_set      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_set_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own card_srs all" ON public.card_srs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own daily_set all" ON public.daily_set
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own daily_set_item all" ON public.daily_set_item
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- review_log is append-only: owner may read and insert, never update/delete.
CREATE POLICY "own review_log read" ON public.review_log
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own review_log insert" ON public.review_log
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_srs       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_set      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_set_item TO authenticated;
GRANT SELECT, INSERT ON public.review_log TO authenticated;
REVOKE UPDATE, DELETE ON public.review_log FROM authenticated;

CREATE TRIGGER card_srs_updated_at
  BEFORE UPDATE ON public.card_srs FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
