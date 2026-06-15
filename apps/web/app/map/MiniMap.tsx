"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGet } from "@/lib/use-api";
import { GraphSchema, type Graph } from "@/lib/api-types";

const ForceGraph = dynamic(() => import("./ForceGraph"), {
  ssr: false,
  loading: () => (
    <div className="h-full grid place-items-center">
      <span className="font-mono text-xs text-muted">…</span>
    </div>
  ),
});

// Per-note knowledge map: this note's concepts + cards and how they link out to
// related cards in other notes. Renders nothing until there's something to show,
// so notes with no graph yet stay clean.
export function MiniMap({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { data } = useGet<Graph>(noteId ? `/v1/notes/${noteId}/graph` : null, GraphSchema);
  if (!data || data.nodes.length === 0) return null;

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="kicker">Connections</div>
        <Link href="/map" className="font-mono text-[10px] text-marigold-deep hover:underline">
          Full map →
        </Link>
      </div>
      <div className="card overflow-hidden" style={{ height: 300 }}>
        <ForceGraph
          graph={data}
          onNavigate={(id, cardId) =>
            id !== noteId && router.push(cardId ? `/notes/${id}?card=${cardId}` : `/notes/${id}`)
          }
        />
      </div>
      <p className="text-muted text-[11px] mt-2 px-0.5">
        Concepts entri found here, and cards in other notes that connect to them.
      </p>
    </section>
  );
}
