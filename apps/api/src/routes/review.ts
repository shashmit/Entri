import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { ReviewCard } from "@entri/types";
import { orThrow, formatInterval } from "../utils/index.js";
import { scheduler, review as applyReview, newCard, type CardRow, type Grade } from "../services/fsrs.js";
import { Rating, type Card } from "ts-fsrs";

export const review = new Hono<AppEnv>();

type QueueRow = CardRow & {
  item_id: string;
  items: {
    topic: string | null;
    origin: string;
    question: string | null;
    answer: string | null;
    source_quote: string | null;
    source_highlight: string | null;
    source_ref: string | null;
    review_status: string;
  };
};

// GET /v1/review/queue — cards due now, in the ReviewCard shape the UI renders,
// with real FSRS interval previews for each grade button.
review.get("/queue", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const now = new Date();

  const params = orThrow(
    await db.database.from("srs_params").select("weights, desired_retention").eq("user_id", userId).maybeSingle()
  ) as { weights: number[] | null; desired_retention: number } | null;
  const f = scheduler(params ?? undefined);

  const rows = orThrow(
    await db.database
      .from("card_srs")
      .select(
        "item_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, items!inner(topic, origin, question, answer, source_quote, source_highlight, source_ref, review_status)"
      )
      .eq("items.review_status", "active")
      .lte("due", now.toISOString())
      .order("due", { ascending: true })
      .limit(60)
  ) as unknown as QueueRow[];

  const cards = rows.map((r): ReviewCard => {
    const sched = f.repeat(toCard(r), now) as Record<Rating, { card: Card }>;
    const dueFor = (g: Rating) => formatInterval(now, new Date(sched[g].card.due));
    return {
      id: r.item_id,
      topic: r.items.topic,
      origin: r.items.origin as ReviewCard["origin"],
      question: r.items.question,
      answer: r.items.answer,
      source: {
        quote: r.items.source_quote ?? "",
        highlight: r.items.source_highlight ?? "",
        ref: r.items.source_ref ?? "",
      },
      intervals: {
        again: dueFor(Rating.Again),
        hard: dueFor(Rating.Hard),
        good: dueFor(Rating.Good),
        easy: dueFor(Rating.Easy),
      },
    };
  });

  return c.json(cards);
});

// POST /v1/review/:itemId  { rating: 1|2|3|4 } — grade a card: advance FSRS
// state, append to review_log, mark the daily-set item complete.
review.post("/:itemId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const itemId = c.req.param("itemId");
  const body = await c.req.json<{ rating: number }>();
  const rating = body.rating as Grade;
  if (![1, 2, 3, 4].includes(rating)) return c.json({ error: "rating must be 1-4" }, 400);

  const row = orThrow(
    await db.database.from("card_srs").select().eq("item_id", itemId).maybeSingle()
  ) as CardRow | null;
  if (!row) return c.json({ error: "card not found" }, 404);

  const params = orThrow(
    await db.database.from("srs_params").select("weights, desired_retention").eq("user_id", userId).maybeSingle()
  ) as { weights: number[] | null; desired_retention: number } | null;
  const f = scheduler(params ?? undefined);

  const now = new Date();
  const { card, log } = applyReview(f, row, rating, now);

  orThrow(
    await db.database
      .from("card_srs")
      .update({
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state,
        last_review: card.last_review,
      })
      .eq("item_id", itemId)
      .select()
      .single()
  );

  orThrow(
    await db.database.from("review_log").insert([
      {
        user_id: userId,
        item_id: itemId,
        rating: log.rating,
        state: log.state,
        due: log.due,
        stability: log.stability,
        difficulty: log.difficulty,
        elapsed_days: log.elapsed_days,
        last_elapsed_days: log.last_elapsed_days,
        scheduled_days: log.scheduled_days,
        reviewed_at: log.review,
      },
    ])
  );

  // Best-effort: mark today's set item done (no-op if the card isn't in a set).
  await db.database
    .from("daily_set_item")
    .update({ completed: true, rating })
    .eq("item_id", itemId)
    .eq("completed", false);

  return c.json({ due: card.due, stability: card.stability, state: card.state });
});

function toCard(r: CardRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.last_review ? new Date(r.last_review) : undefined,
  } as Card;
}
