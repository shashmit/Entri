import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { Readiness } from "@entri/types";
import { orThrow } from "../utils/index.js";
import { scheduler, retrievabilityAt, type CardRow } from "../services/fsrs.js";

export const readiness = new Hono<AppEnv>();

type Row = CardRow & { topic: string | null };

// GET /v1/readiness — predicted recall on exam day, computed from each active
// card's stored FSRS stability decayed to exam_date with no further reviews
// (PLAN.md E5). Honest by construction: no "cards generated" vanity number.
readiness.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const profile = orThrow(
    await db.database.from("profiles").select("exam_date").eq("user_id", userId).maybeSingle()
  ) as { exam_date: string | null } | null;
  const params = orThrow(
    await db.database
      .from("srs_params")
      .select("weights, desired_retention")
      .eq("user_id", userId)
      .maybeSingle()
  ) as { weights: number[] | null; desired_retention: number } | null;

  // card_srs joined to its item's topic (active cards only — card_srs rows
  // are created only when an item becomes studyable).
  const rows = orThrow(
    await db.database
      .from("card_srs")
      .select("due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, items!inner(topic, review_status)")
      .eq("items.review_status", "active")
  ) as unknown as (CardRow & { items: { topic: string | null } })[];

  const f = scheduler(params ?? undefined);
  const at = profile?.exam_date ? new Date(profile.exam_date) : new Date();

  const flat: Row[] = rows.map((r) => ({ ...r, topic: r.items?.topic ?? null }));
  const overall = mean(flat.map((r) => retrievabilityAt(f, r, at)));

  // Per-topic weak-spot breakdown.
  const byTopic = new Map<string, number[]>();
  for (const r of flat) {
    const t = r.topic ?? "Uncategorized";
    (byTopic.get(t) ?? byTopic.set(t, []).get(t)!).push(retrievabilityAt(f, r, at));
  }
  const topics = [...byTopic.entries()]
    .map(([topic, xs]) => ({ topic, percent: Math.round(mean(xs) * 100) }))
    .sort((a, b) => a.percent - b.percent);

  return c.json({
    percent: Math.round(overall * 100),
    examDate: profile?.exam_date ?? null,
    cardCount: flat.length,
    topics,
    deltaWeek: null, // needs a stability snapshot history; deferred (kept honest, not faked)
  } satisfies Readiness);
});

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
