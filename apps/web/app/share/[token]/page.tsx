"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SharedNoteSchema, type SharedNote, type NoteCardItem } from "@/lib/api-types";
import { Loader } from "@/components/HamsterLoader";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Source({ card }: { card: NoteCardItem }) {
  const quote = card.source_quote ?? "";
  if (!quote) return null;
  const hl = card.source_highlight ?? "";
  const i = hl ? quote.indexOf(hl) : -1;
  const before = i >= 0 ? quote.slice(0, i) : quote;
  const after = i >= 0 ? quote.slice(i + hl.length) : "";
  return (
    <div className="prov-slip mt-3">
      {before}
      {i >= 0 && <span className="hl-swipe">{hl}</span>}
      {after}
    </div>
  );
}

export default function SharedNotePage() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<SharedNote | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/public/notes/${token}`);
        if (!res.ok) {
          if (!cancelled) setState("missing");
          return;
        }
        const parsed = SharedNoteSchema.parse(await res.json());
        if (!cancelled) {
          setNote(parsed);
          setState("ok");
        }
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-dvh px-[18px] py-8 md:py-12">
      <div className="max-w-[760px] mx-auto">
        {/* brand bar */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="font-display font-bold tracking-tight text-2xl">
            entri<span className="text-marigold-deep">.</span>
          </Link>
          <span className="font-mono text-[11px] text-muted uppercase tracking-[0.08em]">Shared note</span>
        </div>

        {state === "loading" ? (
          <Loader />
        ) : state === "missing" || !note ? (
          <div className="card p-8 text-center">
            <p className="font-display text-[19px] mb-1">This note isn&apos;t available.</p>
            <p className="text-muted text-[13.5px] mb-4">The link may be wrong, or sharing was turned off.</p>
            <Link href="/" className="btn-p">
              About entri
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-2">
              {note.topic && <span className="chip">{note.topic}</span>}
              <h1 className="font-display font-semibold text-[clamp(26px,6vw,34px)] tracking-tight leading-[1.1] mt-2">
                {note.title}
              </h1>
              <p className="font-mono text-[11px] text-muted mt-1.5">
                {note.ref}
                {note.ref && note.capturedAt ? " · " : ""}
                {note.capturedAt ? fmtDate(note.capturedAt) : ""}
              </p>
            </div>

            {note.cards.length > 0 && (
              <section className="mt-5 flex flex-col gap-3">
                <div className="kicker px-0.5">
                  {note.cards.length} card{note.cards.length === 1 ? "" : "s"}
                </div>
                {note.cards.map((card, i) => (
                  <div key={card.id} className="card p-5">
                    <span className="font-mono text-[10px] text-muted tabnum">Card {i + 1}</span>
                    <h2 className="font-display font-semibold text-[19px] leading-[1.3] mt-1.5">{card.question}</h2>
                    {card.answer && <p className="text-[15px] leading-[1.6] text-ink-soft mt-2">{card.answer}</p>}
                    <Source card={card} />
                  </div>
                ))}
              </section>
            )}

            {note.corrections.length > 0 && (
              <section className="mt-7">
                <div className="kicker mb-3 px-0.5">Suggested corrections · {note.corrections.length}</div>
                {note.corrections.map((cr) => (
                  <div key={cr.id} className="inferred-card mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.07em] text-taupe-ink mb-2">
                      AI-flagged · {cr.status}
                    </p>
                    <p className="text-[14px] text-ink-soft leading-[1.6]">
                      <span className="line-through opacity-70">{cr.original_text}</span>{" "}
                      <span aria-hidden="true">→</span>{" "}
                      <span className="font-semibold text-ink">{cr.suggested_text}</span>
                    </p>
                    <p className="text-[12.5px] text-muted mt-1.5">{cr.rationale}</p>
                  </div>
                ))}
              </section>
            )}

            {note.images.length > 0 && (
              <section className="mt-7">
                <div className="kicker mb-3 px-0.5">Source page{note.images.length > 1 ? "s" : ""}</div>
                <div className="flex gap-3 flex-wrap">
                  {note.images.map((img) => {
                    const src = `${API}/public/notes/${token}/image/${img.pageIndex}`;
                    return img.isPdf ? (
                      <a
                        key={img.pageIndex}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card flex flex-col items-center justify-center gap-1 w-[140px] h-[180px]"
                      >
                        <span className="text-[28px]" aria-hidden="true">📄</span>
                        <span className="font-mono text-[10px] text-marigold-deep">Open PDF</span>
                      </a>
                    ) : (
                      <a key={img.pageIndex} href={src} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Source page ${img.pageIndex + 1}`}
                          className="w-[140px] h-[180px] object-cover rounded-md border border-line shadow-paper"
                        />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="mt-10 pt-5 border-t border-line text-center">
              <p className="text-muted text-[13px]">
                Made with entri — photograph your notes, study what sticks.
              </p>
              <Link href="/signin" className="btn-s mt-3 inline-flex">
                Try entri
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
