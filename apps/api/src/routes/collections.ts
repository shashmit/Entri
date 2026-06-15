import { Hono } from "hono";
import { CollectionUpsertSchema, type Collection } from "@entri/types";
import type { AppEnv } from "../middleware/auth.js";
import { orThrow } from "../utils/index.js";

export const collections = new Hono<AppEnv>();

// All writes go through the user's RLS-scoped client; user_id is set/checked by
// the owner policies, so a user can only ever touch their own collections.
const COLS = "id, name";

// GET /v1/collections — the user's collections (newest first) with how many live
// notes each holds. Counts are computed from the user's live notes in one pass
// rather than per-collection round-trips.
collections.get("/", async (c) => {
  const db = c.get("db");

  const [cols, noteRows] = await Promise.all([
    db.database.from("collections").select(COLS).order("created_at", { ascending: false }),
    db.database.from("notes").select("collection_id").is("deleted_at", null),
  ]);

  const rows = orThrow(cols) as { id: string; name: string }[];
  const notes = orThrow(noteRows) as { collection_id: string | null }[];

  const counts = new Map<string, number>();
  for (const n of notes) {
    if (n.collection_id) counts.set(n.collection_id, (counts.get(n.collection_id) ?? 0) + 1);
  }

  return c.json(
    rows.map((r): Collection => ({ id: r.id, name: r.name, noteCount: counts.get(r.id) ?? 0 }))
  );
});

// POST /v1/collections — create a collection with a title.
collections.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const parsed = CollectionUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid collection" }, 400);

  const created = orThrow(
    await db.database
      .from("collections")
      .insert([{ name: parsed.data.name, user_id: userId }])
      .select(COLS)
      .single()
  ) as { id: string; name: string };
  return c.json({ ...created, noteCount: 0 } satisfies Collection, 201);
});

// PATCH /v1/collections/:id — rename.
collections.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const parsed = CollectionUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid collection" }, 400);

  const updated = orThrow(
    await db.database.from("collections").update({ name: parsed.data.name }).eq("id", id).select(COLS).maybeSingle()
  ) as { id: string; name: string } | null;
  if (!updated) return c.json({ error: "not found" }, 404);
  return c.json(updated);
});

// DELETE /v1/collections/:id — remove the collection. Its notes are unfiled
// automatically (notes.collection_id ON DELETE SET NULL), never deleted.
collections.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  orThrow(await db.database.from("collections").delete().eq("id", id));
  return c.body(null, 204);
});
