"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGet } from "@/lib/use-api";
import { api } from "@/lib/api";
import { insforge } from "@/lib/insforge";
import { MiniMap } from "@/app/map/MiniMap";
import {
  NoteDetailSchema,
  NoteCardListSchema,
  type NoteDetail,
  type NoteCard,
  type NoteCardItem,
} from "@/lib/api-types";
import { Loader, HamsterLoader } from "@/components/HamsterLoader";

const BUCKET = "note-images";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// The uploaded source pages. The bucket is private, so we download each blob
// with the user's own browser session and render it from an object URL.
function SourcePages({ images }: { images: NoteDetail["images"] }) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      const out = await Promise.all(
        images.map(async (img) => {
          const dl = await insforge.storage.from(BUCKET).download(img.blobKey);
          if (dl.error || !dl.data) return null;
          const u = URL.createObjectURL(dl.data);
          made.push(u);
          return u;
        })
      );
      if (!cancelled) setUrls(out);
    })();
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [images]);

  if (images.length === 0) return null;
  return (
    <section className="mt-5">
      <div className="kicker mb-3 px-0.5">Source page{images.length > 1 ? "s" : ""}</div>
      <div className="flex gap-3 flex-wrap">
        {images.map((img, i) => {
          const url = urls[i];
          return (
            <div key={img.blobKey} className="w-[140px]">
              {url && img.isPdf ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card flex flex-col items-center justify-center gap-1 w-[140px] h-[180px] hover:-translate-y-0.5 transition-transform"
                  title="Open PDF"
                >
                  <span className="text-[28px]" aria-hidden="true">📄</span>
                  <span className="font-mono text-[10px] text-marigold-deep">Open PDF</span>
                </a>
              ) : url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Source page ${img.pageIndex + 1}`}
                    className="w-[140px] h-[180px] object-cover rounded-md border border-line shadow-paper hover:-translate-y-0.5 transition-transform"
                  />
                </a>
              ) : (
                <div className="w-[140px] h-[180px] rounded-md border border-line bg-surface grid place-items-center">
                  <HamsterLoader size={44} />
                </div>
              )}
              <div className="flex items-center justify-between mt-1.5 px-0.5">
                <span className="font-mono text-[10px] text-muted">Page {img.pageIndex + 1}</span>
                {url && (
                  <a
                    href={url}
                    download={img.blobKey.split("/").pop() ?? `page-${img.pageIndex + 1}`}
                    className="font-mono text-[10px] text-marigold-deep hover:underline"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-muted text-[11px] mt-2 px-0.5">Download saves the original upload — full quality.</p>
    </section>
  );
}

// The verbatim source line, with the key phrase under a marigold highlighter
// swipe — the "thread back to your own handwriting" the design is built around.
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

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: note, loading, error, refetch } = useGet<NoteDetail>(
    id ? `/v1/notes/${id}` : null,
    NoteDetailSchema
  );
  // All notes — used to populate the category autocomplete.
  const allNotes = useGet<NoteCard[]>("/v1/notes", NoteCardListSchema);
  const categories = [...new Set((allNotes.data ?? []).map((n) => n.topic).filter(Boolean))] as string[];

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", topic: "", source_ref: "" });
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareTok, setShareTok] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  // Sync the share state from the loaded note.
  useEffect(() => {
    if (note) setShareTok(note.shareToken);
  }, [note]);

  // Deep link from the knowledge map: /notes/:id?card=<cardId> scrolls to that
  // exact card and briefly rings it. Read from the URL (not useSearchParams) so
  // the page needs no Suspense boundary.
  useEffect(() => {
    if (!note) return;
    const target = new URLSearchParams(window.location.search).get("card");
    if (!target) return;
    const el = document.getElementById(`card-${target}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setHighlight(target);
    const t = setTimeout(() => setHighlight(null), 2600);
    return () => clearTimeout(t);
  }, [note]);

  const shareUrl = shareTok && typeof window !== "undefined" ? `${window.location.origin}/share/${shareTok}` : "";

  async function del() {
    setDeleting(true);
    try {
      await api.del(`/v1/notes/${id}`);
      router.push("/notes");
    } catch {
      setDeleting(false);
      setConfirmDel(false);
    }
  }

  async function toggleShare() {
    setSharing(true);
    try {
      if (shareTok) {
        await api.del(`/v1/notes/${id}/share`);
        setShareTok(null);
        setCopied(false);
      } else {
        const { shareToken } = await api.post<{ shareToken: string }>(`/v1/notes/${id}/share`);
        setShareTok(shareToken);
      }
    } finally {
      setSharing(false);
    }
  }

  function copyShare() {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
  }

  function startEdit() {
    if (!note) return;
    setForm({
      title: note.title === "Untitled note" ? "" : note.title,
      topic: note.topic ?? "",
      source_ref: note.ref,
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/v1/notes/${id}`, {
        title: form.title.trim() || null,
        topic: form.topic.trim() || null,
        source_ref: form.source_ref.trim() || null,
      });
      await Promise.all([refetch(), allNotes.refetch()]);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[760px] mx-auto">
      <Link href="/notes" className="inline-flex items-center gap-1.5 font-mono text-[12px] text-marigold-deep hover:underline">
        <span aria-hidden="true">←</span> All notes
      </Link>

      {loading ? (
        <Loader className="mt-6" />
      ) : error || !note ? (
        <div className="card p-8 text-center mt-6">
          <p className="font-display text-[19px] mb-1">Note not found.</p>
          <p className="text-muted text-[13.5px] mb-4">It may have been deleted, or the link is wrong.</p>
          <Link href="/notes" className="btn-s">Back to notes</Link>
        </div>
      ) : editing ? (
        /* edit: title + category + source */
        <section className="card p-5 mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[14px]">Title</span>
            <input
              className="field"
              value={form.title}
              placeholder="Untitled note"
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[14px]">Category</span>
            <input
              className="field"
              list="note-categories"
              value={form.topic}
              placeholder="e.g. Biology"
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            />
            <datalist id="note-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <span className="text-muted text-[11.5px]">Type a new category or pick an existing one.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-[14px]">Source</span>
            <input
              className="field"
              value={form.source_ref}
              placeholder="e.g. Notebook 2 · p.14"
              onChange={(e) => setForm((f) => ({ ...f, source_ref: e.target.value }))}
            />
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-p disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="btn-s">
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* header */}
          <div className="mt-4 mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
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
            <div className="flex items-center gap-2 shrink-0">
              {confirmDel ? (
                <>
                  <span className="text-[12.5px] text-ink-soft">Delete this note?</span>
                  <button
                    onClick={del}
                    disabled={deleting}
                    className="text-[13px] font-semibold bg-brick text-paper2 rounded-sm px-3 py-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                  <button onClick={() => setConfirmDel(false)} className="btn-s text-[13px] px-3 py-1.5">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={toggleShare} disabled={sharing} className="btn-s text-[13px] px-3.5 py-1.5 disabled:opacity-60">
                    {sharing ? "…" : shareTok ? "Sharing" : "Share"}
                  </button>
                  <button onClick={startEdit} className="btn-s text-[13px] px-3.5 py-1.5">
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDel(true)}
                    aria-label="Delete note"
                    className="text-[13px] font-semibold text-ink-soft border-[1.5px] border-line rounded-sm px-3 py-1.5 cursor-pointer hover:border-brick hover:text-brick transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* share bar — visible once the note has a public link */}
          {shareTok && (
            <div className="card flex flex-wrap items-center gap-2 p-3 mb-2">
              <span className="kicker shrink-0">Public link</span>
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Public share link"
                className="field flex-1 min-w-[180px] text-[12.5px] font-mono"
              />
              <button onClick={copyShare} className="btn-p text-[13px] px-3.5 py-2">
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={toggleShare}
                disabled={sharing}
                className="text-[12.5px] font-semibold text-ink-soft hover:text-brick transition-colors px-2 py-2 cursor-pointer disabled:opacity-60"
              >
                Stop sharing
              </button>
            </div>
          )}

          {/* cards */}
          {note.cards.length === 0 ? (
            <div className="card p-6 mt-5 text-center">
              <p className="text-[14px] text-ink-soft">
                {note.status === "failed"
                  ? "entri couldn't read this as study notes. Try recapturing a clearer, well-lit photo."
                  : "No cards have been extracted from this note yet."}
              </p>
            </div>
          ) : (
            <section className="mt-5 flex flex-col gap-3">
              <div className="kicker px-0.5">
                {note.cards.length} card{note.cards.length === 1 ? "" : "s"}
              </div>
              {note.cards.map((card, i) => (
                <div
                  key={card.id}
                  id={`card-${card.id}`}
                  className={`card p-5 scroll-mt-[72px] transition-shadow duration-500 ${
                    highlight === card.id ? "ring-2 ring-marigold ring-offset-2 ring-offset-paper" : ""
                  }`}
                >
                  <span className="font-mono text-[10px] text-muted tabnum">Card {i + 1}</span>
                  <h2 className="font-display font-semibold text-[19px] leading-[1.3] mt-1.5">{card.question}</h2>
                  {card.answer && <p className="text-[15px] leading-[1.6] text-ink-soft mt-2">{card.answer}</p>}
                  <Source card={card} />
                </div>
              ))}
            </section>
          )}

          {/* corrections — surfaced, never applied (taupe / dashed = tentative) */}
          {note.corrections.length > 0 && (
            <section className="mt-7">
              <div className="kicker mb-3 px-0.5">Suggested corrections · {note.corrections.length}</div>
              {note.corrections.map((cr) => {
                // Best-effort link to the card this correction relates to: the
                // card whose verbatim source line contains the flagged text.
                const o = cr.original_text.toLowerCase().replace(/\s+/g, " ").trim();
                const related =
                  o.length >= 6
                    ? note.cards.find((c) => {
                        const q = (c.source_quote ?? "").toLowerCase().replace(/\s+/g, " ").trim();
                        return q.length >= 6 && (q.includes(o) || o.includes(q));
                      })
                    : undefined;
                return (
                  <div key={cr.id} className="inferred-card mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.07em] text-taupe-ink mb-2">
                      AI-flagged · {cr.status}
                    </p>
                    {related?.question && (
                      <p className="text-[13px] font-medium text-ink mb-1.5">{related.question}</p>
                    )}
                    <p className="text-[14px] text-ink-soft leading-[1.6]">
                      <span className="line-through opacity-70">{cr.original_text}</span>{" "}
                      <span aria-hidden="true">→</span>{" "}
                      <span className="font-semibold text-ink">{cr.suggested_text}</span>
                    </p>
                    <p className="text-[12.5px] text-muted mt-1.5">{cr.rationale}</p>
                  </div>
                );
              })}
            </section>
          )}

          {/* this note's local knowledge map (renders only once it has nodes) */}
          <MiniMap noteId={id} />

          {/* the uploaded source page(s) — kept at the bottom, after the cards */}
          <SourcePages images={note.images} />
        </>
      )}
    </div>
  );
}
