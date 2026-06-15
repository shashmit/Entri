"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGet } from "@/lib/use-api";
import { api } from "@/lib/api";
import type { ReviewCard, Streak } from "@/lib/api-types";
import { ReviewCardListSchema, StreakSchema } from "@/lib/api-types";

type Grade = "again" | "hard" | "good" | "easy";
const RATING: Record<Grade, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };

function ProvSlip({ card }: { card: ReviewCard }) {
  const { quote, highlight, ref } = card.source;
  const i = highlight ? quote.indexOf(highlight) : -1;
  const before = i >= 0 ? quote.slice(0, i) : quote;
  const after = i >= 0 ? quote.slice(i + highlight.length) : "";
  return (
    <div className="mt-6">
      <p className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-teal mb-2 flex items-center gap-[7px]">
        <span className="w-[15px] h-[15px] rounded-full bg-teal-soft text-teal grid place-items-center text-[9px] shrink-0" aria-hidden="true">
          ✓
        </span>
        {card.origin === "inferred" ? "Inferred from your notes" : "From your notes"}
      </p>
      <div className="prov-slip">
        {before}
        {i >= 0 && <span className="hl-swipe">{highlight}</span>}
        {after}
        {ref && (
          <span className="block mt-2.5 font-mono not-italic text-[10.5px] text-muted">{ref}</span>
        )}
      </div>
    </div>
  );
}

export default function Review() {
  const router = useRouter();
  const { data, loading } = useGet<ReviewCard[]>("/v1/review/queue", ReviewCardListSchema);
  const streak = useGet<Streak>("/v1/streak", StreakSchema);

  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [lastGrade, setLastGrade] = useState<Grade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const queue = data ?? [];
  const total = queue.length;
  const card = queue[idx];

  async function grade(g: Grade) {
    if (submitting || lastGrade) return;
    setSubmitting(true);
    try {
      await api.post(`/v1/review/${card.id}`, { rating: RATING[g] });
      setLastGrade(g);
      // "Again" pauses on the card so the fail→explain nudge is usable.
      if (g !== "again") advance();
    } finally {
      setSubmitting(false);
    }
  }

  function advance() {
    setLastGrade(null);
    setRevealed(false);
    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  }

  /* ---------- loading / empty ---------- */
  if (loading) {
    return (
      <main className="max-w-[640px] mx-auto px-[18px] pt-16 grid place-items-center">
        <span className="font-mono text-xs text-muted">loading your set…</span>
      </main>
    );
  }

  if (done || total === 0) {
    return (
      <main className="max-w-[640px] mx-auto px-[18px] pt-16 pb-12">
        <div className="card text-center px-6 py-11 pop-in">
          <p className="font-display font-bold text-[40px] tracking-tight">
            {total === 0 ? "All caught up." : "Set complete."}
          </p>
          <p className="text-ink-soft mt-2.5">
            {total === 0
              ? "Nothing due right now. Capture a note or come back when cards are due."
              : `${total} cards reviewed. Tomorrow's set is already on the curve.`}
          </p>
          {total > 0 && (
            <p className="inline-flex items-center gap-2 mt-4 font-mono text-[13px] tabnum text-marigold-deep">
              <span aria-hidden="true">▲</span> streak is now {(streak.data?.days ?? 0) + 1} days
            </p>
          )}
          <div className="flex gap-2.5 justify-center mt-6 flex-wrap">
            <Link href="/today" className="btn-p">
              Back to today
            </Link>
            <Link href="/readiness" className="btn-s">
              See readiness
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- session ---------- */
  return (
    <main className="max-w-[640px] mx-auto px-[18px] pb-12">
      {/* top: exit + progress */}
      <div className="flex items-center gap-3.5 pt-3.5 pb-4">
        <button
          onClick={() => router.push("/today")}
          aria-label="Leave session"
          className="w-11 h-11 grid place-items-center border-[1.5px] border-line rounded-sm text-ink-soft hover:border-marigold transition-colors cursor-pointer"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div
          className="flex-1 h-1.5 rounded-[2px] bg-line overflow-hidden"
          role="progressbar"
          aria-label="Cards reviewed in this session"
          aria-valuenow={idx + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <i
            className="block h-full bg-marigold rounded-[2px] transition-[width] duration-300"
            style={{ width: `${((idx + (revealed ? 1 : 0.4)) / total) * 100}%` }}
          />
        </div>
        <span className="font-mono text-[11.5px] text-muted tabnum whitespace-nowrap">
          {idx + 1} / {total}
        </span>
      </div>

      {/* the study card */}
      <div className="card p-6 card-swap" key={card.id}>
        {card.origin === "inferred" ? (
          <span className="chip-inferred">AI-inferred · accepted by you</span>
        ) : (
          <span className="chip">{card.topic}</span>
        )}

        <h1 className="font-display font-semibold text-[clamp(21px,5vw,26px)] leading-[1.25] mt-4">
          {card.question}
        </h1>

        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="btn-p w-full mt-6">
            Show answer
          </button>
        ) : (
          <>
            <div className="mt-5 pt-5 border-t border-dotted border-line text-[16.5px] leading-[1.65] text-ink-soft [&_b]:text-ink">
              {card.answer}
            </div>

            {/* grading — FSRS four-button */}
            <div className="grid grid-cols-4 gap-2 mt-6">
              {(
                [
                  ["again", "Again", "hover:border-brick hover:bg-[color-mix(in_srgb,var(--brick)_7%,transparent)]"],
                  ["hard", "Hard", "hover:border-marigold-deep hover:bg-[color-mix(in_srgb,var(--marigold)_8%,transparent)]"],
                  ["good", "Good", "hover:border-teal hover:bg-[color-mix(in_srgb,var(--teal)_7%,transparent)]"],
                  ["easy", "Easy", "hover:border-teal hover:bg-[color-mix(in_srgb,var(--teal)_7%,transparent)]"],
                ] as [Grade, string, string][]
              ).map(([g, label, hover]) => (
                <button
                  key={g}
                  onClick={() => grade(g)}
                  disabled={submitting || lastGrade !== null}
                  className={`font-semibold text-sm border-[1.5px] border-line rounded-sm px-1 py-3 transition hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:cursor-default disabled:hover:translate-y-0 ${hover} ${
                    lastGrade === "again" && g === "again"
                      ? "border-brick bg-[color-mix(in_srgb,var(--brick)_7%,transparent)]"
                      : ""
                  }`}
                >
                  {label}
                  <small className="block font-normal text-[10.5px] text-muted mt-0.5 tabnum">
                    {card.intervals[g]}
                  </small>
                </button>
              ))}
            </div>

            {/* fail → explain (E4) */}
            {lastGrade === "again" && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_8%,transparent)] px-4 py-3 text-[13.5px] text-ink-soft card-swap">
                <span>Tough one. Want a quick explanation from your own notes?</span>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href="/chat"
                    className="bg-info text-paper2 text-[12.5px] font-semibold px-3.5 py-1.5 rounded-sm whitespace-nowrap"
                  >
                    Explain it
                  </Link>
                  <button
                    onClick={advance}
                    className="text-[12.5px] font-semibold text-ink-soft border border-line px-3.5 py-1.5 rounded-sm cursor-pointer hover:bg-surface whitespace-nowrap"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* provenance — visible after reveal */}
      {revealed && <ProvSlip card={card} />}
    </main>
  );
}
