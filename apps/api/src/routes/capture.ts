import { Hono } from "hono";
import { waitUntil } from "@vercel/functions";
import type { AppEnv } from "../middleware/auth.js";
import { admin } from "../lib/insforge.js";
import { aiConfigured, extractionConfigured } from "../lib/ai.js";
import { drainQueue, nudgeWorker } from "../services/ingest-worker.js";
import { env } from "../config/env.js";
import { orThrow } from "../utils/index.js";

export const capture = new Hono<AppEnv>();

const BUCKET = "note-images";

type Body = {
  title?: string;
  sourceRef?: string;
  images: { base64: string; mediaType?: string }[];
};

// POST /v1/capture — create a note from one or more photos (E8 batch). Uploads
// to storage under a server-minted key, then enqueues an ingest job the worker
// drains. Returns the noteId to poll.
capture.post("/", async (c) => {
  if (!aiConfigured() || !extractionConfigured()) {
    return c.json({ error: "AI not configured on the server" }, 503);
  }

  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<Body>();
  if (!body.images?.length) return c.json({ error: "no images" }, 400);

  // Note row (RLS-scoped).
  const note = orThrow(
    await db.database
      .from("notes")
      .insert([{ user_id: userId, title: body.title ?? null, source_ref: body.sourceRef ?? null, status: "capturing" }])
      .select("id")
      .single()
  ) as { id: string };

  // Validate file types up front so we fail fast before any upload starts.
  for (const { mediaType } of body.images) {
    const mt = mediaType ?? "image/jpeg";
    if (!mt.startsWith("image/") && mt !== "application/pdf") {
      return c.json({ error: `unsupported file type: ${mt}` }, 400);
    }
  }

  // Upload every file (image or PDF) under a server-minted per-user key and record
  // it — concurrently, so a multi-page capture pays one round-trip, not N.
  await Promise.all(
    body.images.map(async ({ base64, mediaType }, i) => {
      const mt = mediaType ?? "image/jpeg";
      const ext = mt === "application/pdf" ? "pdf" : mt.includes("png") ? "png" : "jpg";
      const key = `${userId}/${note.id}/${i}.${ext}`;
      const file = new File([Buffer.from(base64, "base64")], `${i}.${ext}`, { type: mt });

      const up = await admin.storage.from(BUCKET).upload(key, file);
      if (up.error) throw up.error;

      orThrow(
        await db.database
          .from("images")
          .insert([{ user_id: userId, note_id: note.id, blob_key: up.data?.key ?? key, page_index: i, status: "uploaded" }])
          .select("id")
          .single()
      );
    })
  );

  // Enqueue ingest (jobs are server-only writes → admin client).
  const job = await admin.database
    .from("jobs")
    .insert([{ user_id: userId, type: "ingest", status: "queued", payload: { noteId: note.id } }])
    .select("id");
  if (job.error) throw job.error;

  // Process the job promptly. On Vercel there's no persistent worker, so drain in
  // this invocation's background (waitUntil keeps the function alive past the
  // response, bounded by maxDuration); the daily cron is the backstop. On a
  // long-running host the in-process worker is already polling — just nudge it.
  // Either way the durable queue guarantees the job eventually runs.
  if (env.VERCEL) waitUntil(drainQueue({ maxJobs: 1 }));
  else nudgeWorker();

  return c.json({ noteId: note.id, status: "queued" });
});

// GET /v1/capture/:noteId — poll extraction status.
capture.get("/:noteId", async (c) => {
  const db = c.get("db");
  const note = orThrow(
    await db.database.from("notes").select("id, status, title").eq("id", c.req.param("noteId")).maybeSingle()
  ) as { id: string; status: string; title: string | null } | null;
  if (!note) return c.json({ error: "not found" }, 404);

  const cards = await db.database
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("note_id", note.id)
    .eq("kind", "card");
  if (cards.error) throw cards.error;

  return c.json({ status: note.status, cardCount: cards.count ?? 0 });
});
