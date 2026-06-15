"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGet } from "@/lib/use-api";
import { api } from "@/lib/api";
import type { NoteCard, Collection } from "@/lib/api-types";
import { NoteCardListSchema, CollectionListSchema } from "@/lib/api-types";
import { Loader } from "@/components/HamsterLoader";

const UNCATEGORIZED = "Uncategorized";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Keep a viewport-positioned menu fully on-screen (it's fixed-positioned and
// only renders after a click, so window is available here).
function clamp(pos: { x: number; y: number }, w = 240, h = 320) {
  if (typeof window === "undefined") return pos;
  return {
    x: Math.min(pos.x, window.innerWidth - w - 8),
    y: Math.min(pos.y, window.innerHeight - h - 8),
  };
}

// The note's three-dot / right-click menu: move the note into an existing
// collection, spin up a new one (with a title), or unfile it.
function NoteMenu({
  note,
  collections,
  pos,
  onClose,
  onChanged,
}: {
  note: NoteCard;
  collections: Collection[];
  pos: { x: number; y: number };
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const at = clamp(pos);

  const assign = async (collectionId: string | null) => {
    setBusy(true);
    try {
      await api.patch(`/v1/notes/${note.id}`, { collection_id: collectionId });
      await onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const createAndAssign = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const col = await api.post<Collection>("/v1/collections", { name: trimmed });
      await api.patch(`/v1/notes/${note.id}`, { collection_id: col.id });
      await onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 card p-1.5 w-56 shadow-lg"
        style={{ top: at.y, left: at.x }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker px-2.5 pt-1.5 pb-1">Add to collection</p>

        <div className="max-h-44 overflow-y-auto">
          {collections.length === 0 && !creating ? (
            <p className="text-muted text-[12.5px] px-2.5 py-1.5">No collections yet.</p>
          ) : (
            collections.map((c) => {
              const active = note.collectionId === c.id;
              return (
                <button
                  key={c.id}
                  disabled={busy}
                  onClick={() => assign(active ? null : c.id)}
                  className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm text-[13.5px] hover:bg-surface disabled:opacity-50"
                >
                  <span className="truncate">{c.name}</span>
                  {active && <span className="text-marigold font-semibold shrink-0">✓</span>}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-line my-1" />

        {creating ? (
          <div className="px-1.5 py-1">
            <input
              autoFocus
              className="field !py-1.5 !text-[13.5px]"
              placeholder="Collection title…"
              value={name}
              maxLength={80}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createAndAssign();
                if (e.key === "Escape") setCreating(false);
              }}
            />
            <div className="flex gap-1.5 mt-1.5">
              <button
                disabled={busy || !name.trim()}
                onClick={() => void createAndAssign()}
                className="btn-p !py-1.5 !px-3 !text-[13px] flex-1 disabled:opacity-50"
              >
                Create & add
              </button>
              <button
                disabled={busy}
                onClick={() => setCreating(false)}
                className="btn-ghost !py-1.5 !px-3 !text-[13px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={() => setCreating(true)}
            className="w-full text-left px-2.5 py-1.5 rounded-sm text-[13.5px] font-medium hover:bg-surface disabled:opacity-50"
          >
            + New collection…
          </button>
        )}

        {note.collectionId && !creating && (
          <button
            disabled={busy}
            onClick={() => assign(null)}
            className="w-full text-left px-2.5 py-1.5 rounded-sm text-[13.5px] text-brick hover:bg-surface disabled:opacity-50"
          >
            Remove from collection
          </button>
        )}
      </div>
    </>
  );
}

function NoteTile({
  n,
  collections,
  onChanged,
}: {
  n: NoteCard;
  collections: Collection[];
  onChanged: () => Promise<void>;
}) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className="relative group"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
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
        <p className="font-semibold text-sm mt-3 pr-6">{n.title}</p>
        <p className="font-mono text-[10px] text-muted mt-0.5">
          {n.ref}
          {n.capturedAt ? ` · ${fmtDate(n.capturedAt)}` : ""}
        </p>
      </Link>

      <button
        aria-label="Note options"
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenuPos({ x: r.right - 4, y: r.bottom + 4 });
        }}
      >
        <span className="text-lg leading-none -mt-1">⋯</span>
      </button>

      {menuPos && (
        <NoteMenu
          note={n}
          collections={collections}
          pos={menuPos}
          onClose={() => setMenuPos(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

// A collection rendered as a manila folder with a glassine (frosted, translucent)
// front flap and a small stack of note cards fanning up out of the top. The
// "glass" is warm-tinted with a real backdrop-blur + a faint top sheen — kept on
// the notebook side of the design system (tight radius, soft paper shadow), not
// cold glossy glassmorphism. `peek` cards (max 3) hint at how full the folder is.
function CollectionFolder({
  name,
  count,
  active,
  onClick,
}: {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const peek = Math.min(count, 3);
  // back-to-front so the last card sits on top; symmetric fan around centre.
  const cards = Array.from({ length: peek }, (_, i) => {
    const t = peek === 1 ? 0 : i - (peek - 1) / 2; // -…0…+ offset from centre
    return {
      top: 18 - i * 4,
      left: 16 + t * 4,
      right: 16 - t * 4,
      rotate: t * 3,
    };
  });

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="relative block w-full h-28 text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      {/* folder back panel — warm manila body */}
      <div
        className="absolute inset-x-0 bottom-0 top-3 rounded-md border"
        style={{
          background:
            "color-mix(in srgb, var(--surface) 78%, var(--taupe) 22%)",
          borderColor: "color-mix(in srgb, var(--line) 90%, var(--taupe))",
        }}
      />
      {/* folder tab */}
      <div
        className="absolute top-0 left-3 h-5 w-20 rounded-t-md border border-b-0"
        style={{
          background: active
            ? "color-mix(in srgb, var(--marigold) 40%, var(--surface))"
            : "color-mix(in srgb, var(--surface) 74%, var(--taupe) 26%)",
          borderColor: active
            ? "var(--marigold)"
            : "color-mix(in srgb, var(--line) 90%, var(--taupe))",
        }}
      />

      {/* note cards peeking out of the top */}
      {cards.map((c, i) => (
        <div
          key={i}
          className="absolute h-12 rounded-sm border"
          style={{
            top: c.top,
            left: c.left,
            right: c.right,
            transform: `rotate(${c.rotate}deg)`,
            transformOrigin: "bottom center",
            background: "var(--paper)",
            borderColor: "var(--line)",
            boxShadow: "var(--shadow-paper)",
            backgroundImage:
              "linear-gradient(var(--rule) 1px, transparent 1px)",
            backgroundSize: "100% 9px",
            backgroundPosition: "0 10px",
            zIndex: i + 1,
          }}
        />
      ))}

      {/* glassine front flap — frosted, translucent, faint top sheen */}
      <div
        className="absolute inset-x-0 bottom-0 h-[58%] rounded-md border px-3 pb-2.5 flex flex-col justify-end"
        style={{
          zIndex: 10,
          background:
            "linear-gradient(158deg, color-mix(in srgb, var(--paper-2) 66%, transparent) 0%, color-mix(in srgb, var(--surface) 52%, transparent) 100%)",
          backdropFilter: "blur(7px) saturate(1.08)",
          WebkitBackdropFilter: "blur(7px) saturate(1.08)",
          borderColor: active
            ? "var(--marigold)"
            : "color-mix(in srgb, var(--line) 80%, transparent)",
          boxShadow:
            "var(--shadow-paper), inset 0 1px 0 color-mix(in srgb, #ffffff 24%, transparent)",
        }}
      >
        <span className="font-semibold text-[13px] leading-tight truncate text-ink">
          {name}
        </span>
        <span className="font-mono text-[10px] text-muted tabnum mt-0.5">
          {count} {count === 1 ? "note" : "notes"}
        </span>
      </div>
    </button>
  );
}

// Opened when a folder is tapped: a centred dialog listing the notes filed in
// that collection. Each note links straight to its detail page. Esc / backdrop
// close it; body scroll is locked while open.
function CollectionModal({
  collection,
  notes,
  onClose,
}: {
  collection: Collection;
  notes: NoteCard[];
  onClose: () => void;
}) {
  const inside = notes.filter((n) => n.collectionId === collection.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const ruled = {
    backgroundImage: "linear-gradient(var(--rule) 1px, transparent 1px)",
    backgroundSize: "100% 22px",
    backgroundPosition: "0 15px",
  } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      style={{
        background: "color-mix(in srgb, var(--ink) 40%, transparent)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      onClick={onClose}
    >
      <div
        className="card modal-panel w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={collection.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-line">
          <div>
            <h2 className="font-display font-semibold text-[22px] leading-tight">{collection.name}</h2>
            <p className="kicker mt-1">
              {inside.length} {inside.length === 1 ? "note" : "notes"}
            </p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <span className="text-xl leading-none -mt-0.5">×</span>
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {inside.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-display text-[17px] mb-1">This folder is empty.</p>
              <p className="text-muted text-[13.5px]">
                Right-click a note (or use its ⋯ menu) to file it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inside.map((n) => (
                <Link
                  key={n.id}
                  href={`/notes/${n.id}`}
                  onClick={onClose}
                  className="card block p-4 hover:-translate-y-0.5 transition-transform"
                >
                  <p
                    className="font-display italic text-[13px] leading-[1.65] text-ink-soft h-[64px] overflow-hidden"
                    style={ruled}
                  >
                    {n.excerpt}
                  </p>
                  <p className="font-semibold text-sm mt-3">{n.title}</p>
                  <p className="font-mono text-[10px] text-muted mt-0.5">
                    {n.ref}
                    {n.capturedAt ? ` · ${fmtDate(n.capturedAt)}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Notes() {
  const { data: notesData, loading, refetch: refetchNotes } = useGet<NoteCard[]>(
    "/v1/notes",
    NoteCardListSchema
  );
  const { data: colData, refetch: refetchCollections } = useGet<Collection[]>(
    "/v1/collections",
    CollectionListSchema
  );
  const notes = notesData ?? [];
  const collections = colData ?? [];

  const [openId, setOpenId] = useState<string | null>(null);
  const onChanged = async () => {
    await Promise.all([refetchNotes(), refetchCollections()]);
  };

  // The opened folder (modal) — closes itself if that collection disappears.
  const openCollection = collections.find((c) => c.id === openId) ?? null;

  // Group notes by category (topic); Uncategorized sorts last.
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
        <Loader />
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
                  <NoteTile key={n.id} n={n} collections={collections} onChanged={onChanged} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Collections — folders at the lower edge of the screen. Tap a folder to
          open it and browse the notes filed inside. */}
      {collections.length > 0 && (
        <section className="mt-10 pt-5 border-t border-line">
          <div className="kicker mb-4 px-0.5">Collections</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 px-0.5">
            {collections.map((c) => (
              <CollectionFolder
                key={c.id}
                name={c.name}
                count={c.noteCount}
                active={openId === c.id}
                onClick={() => setOpenId(c.id)}
              />
            ))}
          </div>
        </section>
      )}

      {openCollection && (
        <CollectionModal collection={openCollection} notes={notes} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
