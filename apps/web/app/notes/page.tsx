"use client";

import Link from "next/link";
import { useGet } from "@/lib/use-api";
import type { NoteCard } from "@/lib/api-types";
import { NoteCardListSchema } from "@/lib/api-types";

const UNCATEGORIZED = "Uncategorized";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function NoteTile({ n }: { n: NoteCard }) {
  return (
    <Link href={`/notes/${n.id}`} className="card block p-4 hover:-translate-y-0.5 transition-transform">
      <p
        className="font-display italic text-[13px] leading-[1.65] text-ink-soft h-[88px] overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(var(--rule) 1px, transparent 1px)",
          backgroundSize: "100% 22px",
          backgroundPosition: "0 15px",
        }}
      >
        {n.excerpt}
      </p>
      <p className="font-semibold text-sm mt-3">{n.title}</p>
      <p className="font-mono text-[10px] text-muted mt-0.5">
        {n.ref}
        {n.capturedAt ? ` · ${fmtDate(n.capturedAt)}` : ""}
      </p>
    </Link>
  );
}

export default function Notes() {
  const { data, loading } = useGet<NoteCard[]>("/v1/notes", NoteCardListSchema);
  const notes = data ?? [];

  // Group by category (the note's topic); Uncategorized sorts last.
  const groups = (() => {
    const m = new Map<string, NoteCard[]>();
    for (const n of notes) {
      const cat = n.topic?.trim() || UNCATEGORIZED;
      const list = m.get(cat) ?? (m.set(cat, []).get(cat) as NoteCard[]);
      list.push(n);
    }
    return [...m.entries()].sort(([a], [b]) =>
      a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)
    );
  })();

  return (
    <div>
      <div className="flex items-end justify-between mb-5 px-0.5">
        <div>
          <h1 className="font-display font-semibold text-[clamp(26px,6vw,34px)] tracking-tight leading-[1.1]">
            Your notes.
          </h1>
          <p className="text-muted text-[13.5px] mt-1">
            Exactly as you wrote them — every card traces back here.
          </p>
        </div>
        <Link href="/capture" className="btn-p hidden md:inline-flex">
          Capture
        </Link>
      </div>

      {loading ? (
        <p className="text-muted text-[13.5px] px-0.5">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-[19px] mb-1">No notes yet.</p>
          <p className="text-muted text-[13.5px] mb-4">
            Photograph a page and entri builds your first cards — citations and all.
          </p>
          <Link href="/capture" className="btn-p">
            Capture a note
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(([cat, items]) => (
            <section key={cat}>
              <div className="flex items-baseline gap-2 mb-3 px-0.5">
                <span className="kicker">{cat}</span>
                <span className="font-mono text-[10px] text-muted tabnum">{items.length}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {items.map((n) => (
                  <NoteTile key={n.id} n={n} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
