-- entri M0 core: per-user configuration.
-- Tenant key is the InsForge auth user id (uuid). Every app table carries
-- user_id and is isolated with auth.uid()-based RLS (defense-in-depth; the
-- Hono API layers the product gates on top). PLAN.md M0 / blocking decisions 1,3.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users. Product-level config the dashboard,
-- scheduler and readiness query all read (exam date, IANA timezone, study
-- hour, monthly spend ceiling — blocking decisions #2 and #3).
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         TEXT,
  exam_name            TEXT,
  exam_date            DATE,
  timezone             TEXT NOT NULL DEFAULT 'UTC',   -- IANA zone, captured at signup
  study_hour_local     SMALLINT NOT NULL DEFAULT 8 CHECK (study_hour_local BETWEEN 0 AND 23),
  monthly_spend_cap_usd NUMERIC(8,2) NOT NULL DEFAULT 6.00,  -- decision #2 default
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile read" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ---------------------------------------------------------------------------
-- srs_params: per-user FSRS algorithm config, kept separate from product
-- config so per-user weight optimization (deferred) can re-fit `weights`
-- without touching profiles. ts-fsrs owns the semantics.
-- ---------------------------------------------------------------------------
CREATE TABLE public.srs_params (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weights           JSONB,                       -- FSRS-6 weight vector; NULL = library default
  desired_retention NUMERIC(4,3) NOT NULL DEFAULT 0.900 CHECK (desired_retention > 0 AND desired_retention < 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.srs_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own srs_params read" ON public.srs_params
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own srs_params insert" ON public.srs_params
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own srs_params update" ON public.srs_params
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.srs_params TO authenticated;

CREATE TRIGGER srs_params_updated_at
  BEFORE UPDATE ON public.srs_params
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ---------------------------------------------------------------------------
-- streaks: retention state (E2). One row per user; maintained by the API on
-- daily-set completion.
-- ---------------------------------------------------------------------------
CREATE TABLE public.streaks (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_len         INTEGER NOT NULL DEFAULT 0,
  longest_len         INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own streaks read" ON public.streaks
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own streaks insert" ON public.streaks
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own streaks update" ON public.streaks
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.streaks TO authenticated;

CREATE TRIGGER streaks_updated_at
  BEFORE UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
