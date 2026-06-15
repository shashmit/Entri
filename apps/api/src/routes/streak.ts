import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import type { Streak } from "@entri/types";
import { orThrow } from "../utils/index.js";

export const streak = new Hono<AppEnv>();

// GET /v1/streak — streak length + a 7-day "did you study" strip for the UI.
// A day counts as done if any review happened that (server-local) day; today
// is null until the first review lands (matches the mock's tri-state).
streak.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const row = orThrow(
    await db.database.from("streaks").select("current_len, longest_len, last_completed_date").eq("user_id", userId).maybeSingle()
  ) as { current_len: number; longest_len: number; last_completed_date: string | null } | null;

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const logs = orThrow(
    await db.database.from("review_log").select("reviewed_at").gte("reviewed_at", windowStart.toISOString())
  ) as { reviewed_at: string }[];

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const doneDays = new Set(logs.map((l) => dayKey(new Date(l.reviewed_at))));

  const week: (boolean | null)[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const done = doneDays.has(dayKey(d));
    week.push(i === 0 && !done ? null : done); // today not-yet-done = null
  }

  return c.json({
    days: row?.current_len ?? 0,
    longest: row?.longest_len ?? 0,
    week,
  } satisfies Streak);
});
