-- Public sharing: an unguessable per-note token. NULL = not shared. A public
-- read-only endpoint resolves a note by this token (no auth), so "anyone with
-- the link" can view it; clearing the token revokes access.
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS notes_share_token_idx
  ON public.notes (share_token) WHERE share_token IS NOT NULL;
