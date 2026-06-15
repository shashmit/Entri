-- entri knowledge graph ("Map"). HYBRID graph:
--   nodes = AI-extracted canonical concepts (this file) + existing cards
--           (public.items kind='card', reused — never duplicated here).
--   edges = AI typed relations  (source='extracted', has predicate, directed)
--         + embedding cosine links (source='similarity', predicate='related',
--           undirected: subj_id < obj_id enforced in-DB, precomputed at upload).
-- ALL edges live in public.relations so the Map and the per-note mini-map each
-- read with ONE owner-scoped query; the read path never touches pgvector.
-- Writes are admin-worker only; authenticated users get SELECT (read-only Map).

-- norm_label: IMMUTABLE dedupe-key (lower + collapse whitespace + trim edge
-- punctuation). Backs UNIQUE(user_id, norm) so "SEBI" / " sebi." collapse.
CREATE OR REPLACE FUNCTION public.norm_label(raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT regexp_replace(
           regexp_replace(lower(btrim(raw)), '\s+', ' ', 'g'),
           '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g');
$$;

CREATE TABLE public.concepts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,                          -- display: "NITI Aayog"
  norm          TEXT NOT NULL,                          -- = norm_label(label); dedupe key
  kind          TEXT NOT NULL DEFAULT 'concept'
                CHECK (kind IN ('concept','entity','term','event','other')),
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  description   TEXT,                                    -- short AI gloss (tentative)
  topic         TEXT,                                    -- for node coloring
  origin        TEXT NOT NULL DEFAULT 'inferred' CHECK (origin IN ('note','inferred')),
  confidence    NUMERIC(4,3) NOT NULL DEFAULT 0.800 CHECK (confidence >= 0 AND confidence <= 1),
  mention_count INTEGER NOT NULL DEFAULT 0,             -- maintained for orphan reap on delete
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, norm)
);

CREATE TABLE public.concept_mentions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id  UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  note_id     UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  item_id     UUID REFERENCES public.items(id) ON DELETE CASCADE,   -- NULL = note-level
  snippet     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULLS NOT DISTINCT so a note-level (item_id NULL) mention can't duplicate on re-ingest.
  UNIQUE NULLS NOT DISTINCT (user_id, concept_id, note_id, item_id)
);

-- EVERY edge. Polymorphic endpoints: 'concept' -> concepts.id, 'card' -> items.id.
CREATE TABLE public.relations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subj_kind    TEXT NOT NULL CHECK (subj_kind IN ('concept','card')),
  subj_id      UUID NOT NULL,
  obj_kind     TEXT NOT NULL CHECK (obj_kind IN ('concept','card')),
  obj_id       UUID NOT NULL,
  predicate    TEXT NOT NULL,                           -- 'regulates','under','related',...
  source       TEXT NOT NULL CHECK (source IN ('extracted','similarity')),
  confidence   TEXT CHECK (confidence IN ('explicit','inferred')),  -- typed edges only
  weight       NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (weight >= 0 AND weight <= 1),
  source_quote TEXT,
  note_id      UUID REFERENCES public.notes(id) ON DELETE CASCADE,  -- edge provenance
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT (subj_kind = obj_kind AND subj_id = obj_id)),          -- no self-loops
  -- similarity edges are undirected card<->card; enforce the dedupe invariant in-DB.
  CHECK (source <> 'similarity' OR (subj_kind = 'card' AND obj_kind = 'card' AND subj_id < obj_id)),
  UNIQUE (user_id, subj_kind, subj_id, obj_kind, obj_id, predicate, source)
);

CREATE INDEX concepts_user_id_idx           ON public.concepts (user_id);
CREATE INDEX concept_mentions_user_id_idx   ON public.concept_mentions (user_id);
CREATE INDEX concept_mentions_concept_idx   ON public.concept_mentions (concept_id);
CREATE INDEX concept_mentions_note_idx      ON public.concept_mentions (user_id, note_id);
CREATE INDEX relations_user_id_idx          ON public.relations (user_id);
CREATE INDEX relations_note_idx             ON public.relations (user_id, note_id);
CREATE INDEX relations_read_idx             ON public.relations (user_id, source, weight DESC);
CREATE INDEX relations_subj_idx             ON public.relations (subj_kind, subj_id);
CREATE INDEX relations_obj_idx              ON public.relations (obj_kind, obj_id);

ALTER TABLE public.concepts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relations        ENABLE ROW LEVEL SECURITY;

-- Read-only for users (Map is read-only). All writes go through the admin worker.
CREATE POLICY "own concepts read"         ON public.concepts         FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own concept_mentions read" ON public.concept_mentions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own relations read"        ON public.relations        FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.concepts, public.concept_mentions, public.relations TO authenticated;
GRANT EXECUTE ON FUNCTION public.norm_label(TEXT) TO authenticated;

CREATE TRIGGER concepts_updated_at  BEFORE UPDATE ON public.concepts
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER relations_updated_at BEFORE UPDATE ON public.relations
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- Polymorphic endpoints can't FK two tables -> reap orphaned edges when a
-- concept or card parent is deleted. Statement-level, transition table.
CREATE OR REPLACE FUNCTION public.reap_concept_relations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.relations r
  WHERE (r.subj_kind = 'concept' AND r.subj_id IN (SELECT id FROM deleted))
     OR (r.obj_kind  = 'concept' AND r.obj_id  IN (SELECT id FROM deleted));
  RETURN NULL;
END $$;
CREATE TRIGGER concepts_reap_relations AFTER DELETE ON public.concepts
  REFERENCING OLD TABLE AS deleted FOR EACH STATEMENT
  EXECUTE FUNCTION public.reap_concept_relations();

CREATE OR REPLACE FUNCTION public.reap_card_relations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.relations r
  WHERE (r.subj_kind = 'card' AND r.subj_id IN (SELECT id FROM deleted))
     OR (r.obj_kind  = 'card' AND r.obj_id  IN (SELECT id FROM deleted));
  RETURN NULL;
END $$;
CREATE TRIGGER items_reap_relations AFTER DELETE ON public.items
  REFERENCING OLD TABLE AS deleted FOR EACH STATEMENT
  EXECUTE FUNCTION public.reap_card_relations();

-- WRITE PATH (worker, admin client which bypasses RLS): per-item cross-note kNN.
-- caller_user_id is the tenant boundary; the EXISTS guard turns a mismatched
-- call into a loud failure instead of a silent empty result.
CREATE OR REPLACE FUNCTION public.match_neighbors_for(
  source_item_id UUID, caller_user_id UUID, model TEXT,
  match_count INT DEFAULT 6, match_threshold DOUBLE PRECISION DEFAULT 0.70)
RETURNS TABLE (neighbor_item_id UUID, similarity DOUBLE PRECISION)
LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = source_item_id AND user_id = caller_user_id) THEN
    RAISE EXCEPTION 'match_neighbors_for: item % not owned by %', source_item_id, caller_user_id;
  END IF;
  RETURN QUERY
  WITH src AS (
    SELECT e.embedding, i.note_id FROM public.embeddings e
    JOIN public.items i ON i.id = e.item_id
    WHERE e.item_id = source_item_id AND e.embed_model = model
      AND i.user_id = caller_user_id AND e.chunk_index = 0 LIMIT 1)
  SELECT e.item_id, 1 - (e.embedding <=> (SELECT embedding FROM src))
  FROM public.embeddings e JOIN public.items i ON i.id = e.item_id
  WHERE e.embed_model = model AND e.item_id <> source_item_id
    AND i.user_id = caller_user_id
    AND i.note_id IS DISTINCT FROM (SELECT note_id FROM src)        -- cross-note only
    AND i.review_status = 'active'
    AND 1 - (e.embedding <=> (SELECT embedding FROM src)) >= match_threshold
  ORDER BY e.embedding <=> (SELECT embedding FROM src) LIMIT match_count;
END $$;
GRANT EXECUTE ON FUNCTION public.match_neighbors_for(UUID,UUID,TEXT,INT,DOUBLE PRECISION) TO authenticated;

-- READ PATH (user client, RLS-scoped): typed edges first, then strongest
-- similarity, weight-sorted + capped in SQL so the Map loads instantly (no vectors).
CREATE OR REPLACE FUNCTION public.graph_corpus_edges(
  max_relation INT DEFAULT 1500, max_similarity INT DEFAULT 600)
RETURNS TABLE (subj_kind TEXT, subj_id UUID, obj_kind TEXT, obj_id UUID,
               predicate TEXT, source TEXT, confidence TEXT, weight NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  (SELECT subj_kind,subj_id,obj_kind,obj_id,predicate,source,confidence,weight
     FROM public.relations WHERE source='extracted' ORDER BY weight DESC LIMIT max_relation)
  UNION ALL
  (SELECT subj_kind,subj_id,obj_kind,obj_id,predicate,source,confidence,weight
     FROM public.relations WHERE source='similarity' ORDER BY weight DESC LIMIT max_similarity);
$$;
GRANT EXECUTE ON FUNCTION public.graph_corpus_edges(INT,INT) TO authenticated;
