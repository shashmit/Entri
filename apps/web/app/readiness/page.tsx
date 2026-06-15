"use client";

import { useGet } from "@/lib/use-api";
import {
  daysUntil,
  ReadinessSchema,
  TodaySummarySchema,
  StreakSchema,
  ProfileSchema,
  type Readiness,
  type TodaySummary,
  type Streak,
  type Profile,
} from "@/lib/api-types";

function barColor(p: number) {
  if (p < 50) return "bg-brick";
  if (p < 75) return "bg-marigold";
  return "bg-teal";
}

export default function ReadinessPage() {
  const readiness = useGet<Readiness>("/v1/readiness", ReadinessSchema);
  const today = useGet<TodaySummary>("/v1/today", TodaySummarySchema);
  const streak = useGet<Streak>("/v1/streak", StreakSchema);
  const profile = useGet<Profile>("/v1/me", ProfileSchema);

  const percent = readiness.data?.percent ?? 0;
  const topics = readiness.data?.topics ?? []; // already sorted weakest-first by the API
  const dueCards = today.data?.dueCards ?? 0;
  const days = daysUntil(profile.data?.exam_date ?? null);
  const examName = profile.data?.exam_name ?? "Your exam";
  const streakDays = streak.data?.days ?? 0;

  return (
    <div>
      <div className="mb-5 px-0.5">
        <h1 className="font-display font-semibold text-[clamp(26px,6vw,34px)] tracking-tight leading-[1.1]">
          Readiness.
        </h1>
        <p className="text-muted text-[13.5px] mt-1">
          Predicted recall on exam day — computed from every review, never a vanity metric.
        </p>
      </div>

      {/* field report — black masthead per the Marginalia direction */}
      <div className="rounded-md border-[1.5px] border-ink overflow-hidden card max-w-[720px]">
        <div className="bg-ink text-paper px-6 py-4 flex justify-between items-baseline gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[11px] tracking-[0.1em] uppercase opacity-70">
              {examName}
              {days !== null ? ` · in ${days} days` : ""}
            </p>
            <p className="font-display font-bold text-[48px] leading-none tabnum text-marigold">
              {percent}%
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] tracking-[0.1em] uppercase opacity-70">
              Due today
            </p>
            <p className="font-display font-bold text-[34px] leading-none tabnum">{dueCards}</p>
          </div>
        </div>
        <div className="px-6 py-5">
          {topics.length === 0 ? (
            <p className="py-4 text-[14px] text-muted">
              No cards scheduled yet — capture a note to start tracking readiness.
            </p>
          ) : (
            topics.map((t, i) => (
              <div
                key={t.topic}
                className={`grid grid-cols-[minmax(104px,150px)_1fr_48px] gap-3.5 items-center py-3 ${
                  i > 0 ? "border-t border-dotted border-line" : ""
                }`}
              >
                <span className="font-medium text-[15px] truncate">{t.topic}</span>
                <span className="h-[9px] bg-line rounded-[2px] overflow-hidden">
                  <i
                    className={`block h-full rounded-[2px] ${barColor(t.percent)}`}
                    style={{ width: `${t.percent}%` }}
                  />
                </span>
                <span className="tabnum font-semibold text-sm text-right text-ink-soft">
                  {t.percent}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-[13px] text-muted mt-5 max-w-[58ch] px-0.5">
        Readiness assumes you stop studying today — a conservative reading. Finish your
        daily set ({streakDays}-day streak) and this number climbs.
      </p>
    </div>
  );
}
