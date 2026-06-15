import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { TodaySummary } from "@entri/types";

export const today = new Hono<AppEnv>();

// GET /v1/today — the daily-set summary the home screen leads with.
today.get("/", async (c) => {
  const db = c.get("db");
  const now = new Date();
  const nowIso = now.toISOString();
  const startOfDayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Cards due now (card_srs rows exist only for active, studyable items).
  const due = await db.database
    .from("card_srs")
    .select("item_id", { count: "exact", head: true })
    .lte("due", nowIso);
  if (due.error) throw due.error;
  const dueCards = due.count ?? 0;

  // Reviewed today (approx via server-local day; precise IANA bucketing lands
  // with the reconciler in M2).
  const done = await db.database
    .from("review_log")
    .select("id", { count: "exact", head: true })
    .gte("reviewed_at", startOfDayIso);
  if (done.error) throw done.error;
  const completed = done.count ?? 0;

  return c.json({
    dueCards,
    completed,
    estMinutes: Math.max(1, Math.round(dueCards * 0.5)),
  } satisfies TodaySummary);
});
