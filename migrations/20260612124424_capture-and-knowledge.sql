-- entri M1/M3: capture → extracted knowledge → embeddings (RAG corpus) +
-- first-class corrections. One `items` table (kind discriminates); one
-- `embeddings` table with a real FK and a per-row embed_model so the deferred
-- model-swap migration stays valid. PLAN.md "Schema" headline + E3 + E8.

-- ---------------------------------------------------------------------------
-- notes: one capture set (E8 batch = many images grouped into one note).
-- ---------------------------------------------------------------------------
CREATE TABLE public.notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  source_ref  TEXT,                              -- "Notebook 2 · p.14"
  topic       TEXT,
  status      TEXT NOT NULL DEFAULT 'capturing'  -- capturing | extracted | failed
              CHECK (status IN ('capturing', 'extracted', 'failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- images: raw photo blobs. blob_key is a server-minted storage object key
-- (never client-supplied); per-user isolation enforced here and in storage.
-- ---------------------------------------------------------------------------
CREATE TABLE public.images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id     UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  blob_key    TEXT NOT NULL,
  page_index  SMALLINT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'uploaded'   -- uploaded | processing | extracted | failed
              CHECK (status IN ('uploaded', 'processing', 'extracted', 'failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- items: the unified knowledge table. kind discriminates note passages from
-- study items; origin separates verbatim ('note') from AI ('inferred').
-- Inferred facts land review_status='pending' and never enter reviews until
-- accepted (M4 / blocking decision #4).
-- ---------------------------------------------------------------------------
CREATE TABLE public.items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id         UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('note', 'card', 'cloze', 'fact')),
  origin          TEXT NOT NULL DEFAULT 'note' CHECK (origin IN ('note', 'inferred')),
  topic           TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  body            TEXT,                          -- source passage / card source text
  question        TEXT,
  answer          TEXT,
  source_quote    TEXT,                          -- exact line the item came from
  source_highlight TEXT,                         -- substring of quote for the marigold swipe
  source_ref      TEXT,                          -- "Physics · Notebook 2, p.14"
  span_meta       JSONB,                         -- char offsets into body (cloze + best-effort pixel region)
  review_status   TEXT NOT NULL DEFAULT 'active'
                  CHECK (review_status IN ('active', 'pending', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- embeddings: RAG corpus chunks. Voyage voyage-3-large → vector(1024).
-- embed_model stamped per row; every retrieval filters on it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  chunk_index SMALLINT NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,
  embedding   VECTOR(1024) NOT NULL,
  embed_model TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- corrections: first-class, never a silent edit. The vision pass flags a
-- possible fix; the user accepts or rejects. PLAN.md E3 / "shows its work".
-- ---------------------------------------------------------------------------
CREATE TABLE public.corrections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES public.items(id) ON DELETE CASCADE,
  note_id       UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  rationale     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

-- ============================ indexes ====================================
CREATE INDEX notes_user_id_idx        ON public.notes (user_id);
CREATE INDEX images_user_id_idx       ON public.images (user_id);
CREATE INDEX images_note_id_idx       ON public.images (note_id);
CREATE INDEX items_user_id_idx        ON public.items (user_id);
CREATE INDEX items_note_id_idx        ON public.items (note_id);
CREATE INDEX items_topic_idx          ON public.items (user_id, topic);            -- E5 weak-spot grouping
CREATE INDEX items_review_status_idx  ON public.items (user_id, review_status);
CREATE INDEX embeddings_user_id_idx   ON public.embeddings (user_id);
CREATE INDEX embeddings_item_id_idx   ON public.embeddings (item_id);
CREATE INDEX embeddings_model_idx     ON public.embeddings (user_id, embed_model); -- retrieval filter
CREATE INDEX embeddings_hnsw_idx      ON public.embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX corrections_user_id_idx  ON public.corrections (user_id);
CREATE INDEX corrections_item_id_idx  ON public.corrections (item_id);

-- ============================ RLS + grants ===============================
ALTER TABLE public.notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

-- Owner-scoped CRUD on each table (same shape, one table at a time).
CREATE POLICY "own notes all" ON public.notes
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own images all" ON public.images
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own items all" ON public.items
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own embeddings all" ON public.embeddings
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own corrections all" ON public.corrections
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.images      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embeddings  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrections TO authenticated;

-- updated_at maintenance
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ---------------------------------------------------------------------------
-- match_items: cosine-top-k RAG retrieval. SECURITY INVOKER so the caller's
-- RLS filters to their own rows (cross-user probe returns empty). The API
-- still applies the >=2-chunk grounding gate and post-stream citation check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_items(
  query_embedding VECTOR(1024),
  model           TEXT,
  match_count     INT DEFAULT 8,
  match_threshold DOUBLE PRECISION DEFAULT 0.0
)
RETURNS TABLE (
  item_id    UUID,
  content    TEXT,
  source_ref TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    e.item_id,
    e.content,
    i.source_ref,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.embeddings e
  JOIN public.items i ON i.id = e.item_id
  WHERE e.embed_model = model
    AND 1 - (e.embedding <=> query_embedding) >= match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_items(VECTOR, TEXT, INT, DOUBLE PRECISION) TO authenticated;
