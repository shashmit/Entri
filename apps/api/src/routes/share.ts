import { Hono } from "hono";
import { admin } from "../lib/insforge.js";
import type { SharedNote } from "@entri/types";

const BUCKET = "note-images";

// PUBLIC routes (no auth). A note is reachable only via its unguessable
// share_token; admin client is used because the viewer has no session. Deleted
// or unshared notes resolve to nothing.
export const share = new Hono();

// GET /public/notes/:token — read-only view of a shared note.
share.get("/:token", async (c) => {
  const token = c.req.param("token");
  const noteRes = await admin.database
    .from("notes")
    .select("id, title, source_ref, topic, created_at")
    .eq("share_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (noteRes.error) throw noteRes.error;
  const note = noteRes.data as { id: string; title: string | null; source_ref: string | null; topic: string | null; created_at: string } | null;
  if (!note) return c.json({ error: "not found" }, 404);

  const [itemsR, corrR, imgR] = await Promise.all([
    admin.database.from("items").select("id, question, answer, source_quote, source_highlight, created_at").eq("note_id", note.id).eq("kind", "card").order("created_at", { ascending: true }),
    admin.database.from("corrections").select("id, original_text, suggested_text, rationale, status, created_at").eq("note_id", note.id).order("created_at", { ascending: true }),
    admin.database.from("images").select("blob_key, page_index").eq("note_id", note.id).order("page_index", { ascending: true }),
  ]);
  const items = (itemsR.data ?? []) as { id: string; question: string | null; answer: string | null; source_quote: string | null; source_highlight: string | null }[];
  const corrections = (corrR.data ?? []) as { id: string; original_text: string; suggested_text: string; rationale: string; status: string }[];
  const imgs = (imgR.data ?? []) as { blob_key: string; page_index: number }[];

  const body: SharedNote = {
    title: note.title ?? "Untitled note",
    topic: note.topic,
    ref: note.source_ref ?? "",
    capturedAt: note.created_at,
    cards: items.map((it) => ({
      id: it.id,
      question: it.question,
      answer: it.answer,
      source_quote: it.source_quote,
      source_highlight: it.source_highlight,
    })),
    corrections: corrections.map((cr) => ({
      id: cr.id,
      original_text: cr.original_text,
      suggested_text: cr.suggested_text,
      rationale: cr.rationale,
      status: cr.status,
    })),
    images: imgs.map((im) => ({ pageIndex: im.page_index, isPdf: im.blob_key.toLowerCase().endsWith(".pdf") })),
  };
  return c.json(body satisfies SharedNote);
});

// GET /public/notes/:token/image/:idx — stream one source page of a shared note.
share.get("/:token/image/:idx", async (c) => {
  const token = c.req.param("token");
  const idx = Number(c.req.param("idx"));
  if (!Number.isInteger(idx)) return c.json({ error: "bad index" }, 400);

  const note = (
    await admin.database.from("notes").select("id").eq("share_token", token).is("deleted_at", null).maybeSingle()
  ).data as { id: string } | null;
  if (!note) return c.json({ error: "not found" }, 404);

  const img = (
    await admin.database.from("images").select("blob_key").eq("note_id", note.id).eq("page_index", idx).maybeSingle()
  ).data as { blob_key: string } | null;
  if (!img) return c.json({ error: "not found" }, 404);

  const dl = await admin.storage.from(BUCKET).download(img.blob_key);
  if (dl.error || !dl.data) return c.json({ error: "not found" }, 404);

  const buf = await (dl.data as Blob).arrayBuffer();
  const ext = img.blob_key.toLowerCase().split(".").pop();
  const ct = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
  return c.body(buf, 200, { "Content-Type": ct, "Cache-Control": "private, max-age=300" });
});
