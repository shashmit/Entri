-- entri: note collections. A collection is a user-named folder; each note lives
-- in at most one collection (notes.collection_id). This is orthogonal to `topic`
-- (the freeform category the notes page groups by) — collections are an explicit,
-- user-curated grouping created from the note's three-dot / right-click menu.
CREATE TABLE public.collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX collections_user_id_idx ON public.collections (user_id, created_at DESC);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Owner-scoped CRUD — the user manages their own collections from the notes page.
CREATE POLICY "own collections read" ON public.collections
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own collections insert" ON public.collections
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own collections update" ON public.collections
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own collections delete" ON public.collections
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;

CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- A note belongs to at most one collection. ON DELETE SET NULL: deleting a
-- collection unfiles its notes (they fall back to "Unfiled") rather than
-- cascading the notes away.
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notes_collection_idx ON public.notes (collection_id)
  WHERE collection_id IS NOT NULL AND deleted_at IS NULL;
