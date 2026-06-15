-- Soft delete for notes. Rows stay (recoverable / auditable); views filter on
-- deleted_at IS NULL. Deleting a note also drops its cards from the study set
-- (handled in the API: card_srs rows for the note's items are removed).
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Most reads are "my live notes" — a partial index keeps that fast.
CREATE INDEX IF NOT EXISTS notes_live_idx ON public.notes (user_id, created_at DESC)
  WHERE deleted_at IS NULL;
