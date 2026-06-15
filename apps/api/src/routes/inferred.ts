import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { InferredItem } from "@entri/types";
import { orThrow } from "../utils/index.js";
import { newCard } from "../services/fsrs.js";

export const inferred = new Hono<AppEnv>();

// GET /v1/inferred — AI-inferred facts awaiting the user's OK. These never
// enter reviews until accepted (PLAN.md trust pillar / blocking decision #4).
inferred.get("/", async (c) => {
  const db = c.get("db");
  const rows = orThrow(
    await db.database
      .from("items")
      .select("id, question, answer, source_ref")
      .eq("origin", "inferred")
      .eq("review_status", "pending")
      .order("created_at", { ascending: false })
  ) as { id: string; question: string | null; answer: string | null; source_ref: string | null }[];

  return c.json(
    rows.map((r): InferredItem => ({
      id: r.id,
      text: r.answer ?? r.question ?? "",
      ref: r.source_ref ?? "",
    }))
  );
});

// POST /v1/inferred/:id/accept — promote to a studyable card and seed its FSRS
// state so it joins the review queue.
inferred.post("/:id/accept", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const item = orThrow(
    await db.database
      .from("items")
      .update({ review_status: "active" })
      .eq("id", id)
      .eq("review_status", "pending")
      .select("id")
      .maybeSingle()
  ) as { id: string } | null;
  if (!item) return c.json({ error: "pending inferred item not found" }, 404);

  const card = newCard(new Date());
  orThrow(
    await db.database.from("card_srs").insert([
      {
        item_id: id,
        user_id: userId,
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state,
        last_review: card.last_review ?? null,
      },
    ])
  );

  return c.json({ id, review_status: "active" });
});

// POST /v1/inferred/:id/dismiss — reject the suggestion.
inferred.post("/:id/dismiss", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const item = orThrow(
    await db.database
      .from("items")
      .update({ review_status: "dismissed" })
      .eq("id", id)
      .eq("review_status", "pending")
      .select("id")
      .maybeSingle()
  ) as { id: string } | null;
  if (!item) return c.json({ error: "pending inferred item not found" }, 404);
  return c.json({ id, review_status: "dismissed" });
});
