"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Phase = "idle" | "working" | "done" | "error";
type Preview = { url: string | null; name: string; isPdf: boolean };

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve({ base64: s.slice(s.indexOf(",") + 1), mediaType: file.type || "image/jpeg" });
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function Capture() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [cardCount, setCardCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Thumbnails for the selected files. Object URLs are created here and revoked
  // when the selection changes / unmounts so we don't leak blobs.
  const [previews, setPreviews] = useState<Preview[]>([]);
  useEffect(() => {
    const next: Preview[] = files.map((f) => ({
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      name: f.name,
      isPdf: f.type === "application/pdf",
    }));
    setPreviews(next);
    return () => next.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  }, [files]);

  async function submit() {
    if (!files.length) return;
    setPhase("working");
    setError(null);
    setStatus("Uploading…");
    try {
      const images = await Promise.all(files.map(fileToBase64));
      const { noteId } = await api.post<{ noteId: string }>("/v1/capture", {
        title: title || null,
        sourceRef: sourceRef || null,
        images,
      });

      // Poll extraction (~60s/image).
      setStatus("Reading your handwriting…");
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const s = await api.get<{ status: string; cardCount: number }>(`/v1/capture/${noteId}`);
        if (s.status === "extracted") {
          setCardCount(s.cardCount);
          setPhase("done");
          return;
        }
        if (s.status === "failed") {
          setError("Couldn't read that as study notes. Try a clearer, well-lit photo.");
          setPhase("error");
          return;
        }
      }
      setError("Still processing — check your notes in a moment.");
      setPhase("error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed");
      setPhase("error");
    }
  }

  function reset() {
    setFiles([]);
    setTitle("");
    setSourceRef("");
    setPhase("idle");
    setError(null);
    setCardCount(0);
  }

  return (
    <div className="max-w-[900px]">
      <div className="mb-5 px-0.5 max-w-[560px]">
        <h1 className="font-display font-semibold text-[clamp(26px,6vw,34px)] tracking-tight leading-[1.1]">
          Capture notes.
        </h1>
        <p className="text-muted text-[13.5px] mt-1">
          Photograph a page, batch a whole notebook, or upload a PDF. entri reads your
          handwriting and keeps it exactly as written; anything it can&apos;t read it flags,
          never guesses.
        </p>
      </div>

      {phase === "done" ? (
        <div className="card p-7 text-center pop-in max-w-[560px] mx-auto">
          <p className="font-display font-bold text-[30px] tracking-tight">Extracted.</p>
          <p className="text-ink-soft mt-2">
            {cardCount} {cardCount === 1 ? "card" : "cards"} built from your notes — each linked to
            the line it came from.
          </p>
          <div className="flex gap-2.5 justify-center mt-5 flex-wrap">
            <Link href="/today" className="btn-p">
              Go to today
            </Link>
            <button onClick={reset} className="btn-s">
              Capture another
            </button>
          </div>
        </div>
      ) : phase === "working" ? (
        <div className="card p-7 text-center max-w-[560px] mx-auto" role="status" aria-live="polite">
          <div className="inline-block w-7 h-7 rounded-full border-[3px] border-line border-t-marigold animate-spin" aria-hidden="true" />
          <p className="font-display text-[19px] mt-4">{status}</p>
          <p className="text-muted text-[13px] mt-1">
            Keeping your words verbatim. This takes a moment per page.
          </p>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[1fr_300px] md:gap-5 md:items-start">
          <section className="card p-5 flex flex-col gap-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />

            <button
              onClick={() => inputRef.current?.click()}
              className="border-[1.5px] border-dashed border-line rounded-md py-9 text-center hover:border-marigold transition-colors cursor-pointer"
            >
              <span className="block text-[28px]" aria-hidden="true">📷</span>
              <span className="block font-semibold text-[14.5px] mt-1.5">
                {files.length
                  ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                  : "Choose photos or a PDF"}
              </span>
              <span className="block text-muted text-[12px] mt-0.5">JPG, PNG, or PDF · batch a whole notebook</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <input
                className="field"
                aria-label="Title (optional)"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="field"
                aria-label="Source reference (optional)"
                placeholder="Source e.g. Notebook 2 · p.14"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-brick">
                {error}
              </p>
            )}

            <button onClick={submit} disabled={!files.length} className="btn-p disabled:opacity-50">
              Read &amp; build cards
            </button>
          </section>

          {/* preview card — selected pages, shown alongside the form */}
          <aside className="card p-4 mt-3 md:mt-0">
            <p className="kicker mb-3">
              Preview{files.length ? ` · ${files.length}` : ""}
            </p>
            {previews.length === 0 ? (
              <p className="text-muted text-[12.5px]">Selected pages show up here before you upload.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {previews.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-sm border border-line overflow-hidden bg-paper aspect-[3/4] flex flex-col items-center justify-center"
                    title={p.name}
                  >
                    {p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <span className="text-[24px]" aria-hidden="true">📄</span>
                        <span className="font-mono text-[9px] text-muted mt-1 px-1 truncate max-w-full">
                          {p.isPdf ? "PDF" : p.name.slice(0, 10)}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      {phase === "error" && (
        <div className="mt-4">
          {error && (
            <p role="alert" className="text-[13px] text-brick mb-3 px-0.5">
              {error}
            </p>
          )}
          <button onClick={reset} className="btn-s">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
