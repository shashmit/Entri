import { generateText, Output, wrapLanguageModel, extractJsonMiddleware } from "ai";
import { z } from "zod";
import { chatModel } from "../lib/ai.js";

// What the structuring pass returns. Corrections are NEVER applied silently —
// the OCR text is verbatim and this step only flags possible fixes for the
// user to accept/reject (the trust pillar).
export const Extraction = z.object({
  title: z.string(),
  topic: z.string(),
  unreadable: z.boolean(),
  items: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      source_quote: z.string(),
      source_highlight: z.string(),
    })
  ),
  corrections: z.array(
    z.object({
      original_text: z.string(),
      suggested_text: z.string(),
      rationale: z.string(),
    })
  ),
});
export type Extraction = z.infer<typeof Extraction>;

const PROMPT = `You are entri, turning a student's handwritten study notes into flashcards. The text below is an OCR transcription of a PHOTO of those notes, so expect imperfections.

These are often DENSE exam-prep / current-affairs notes: packed with acronyms and abbreviations, telegraphic half-sentences, margin annotations joined to lines by arrows, words underlined for emphasis, and small tables of figures. Read them like a tutor who knows the subject.

GOAL: capture EVERY distinct fact as its own atomic flashcard. A dense page can legitimately yield 25-40+ cards — do NOT stop at a few. One fact per card; if a single line packs several facts, split it into several cards. Keep each answer to 1-2 short sentences so the whole page fits.

Rules — follow exactly:
- The transcription is the student's own words. NEVER silently fix a factual value. If a value looks wrong (e.g. "100°F" where physics implies "100°C", or a wrong date/figure), keep it verbatim in the card and add a "corrections" entry (original_text, suggested_text, rationale). The student decides.
- Acronyms: in the question and answer, expand an acronym on first use ONLY if you are confident of the standard expansion (e.g. "SEBI (Securities and Exchange Board of India)", "NITI Aayog", "NPS (National Pension System)"). If you are not sure, leave it exactly as written — never invent an expansion.
- Margin notes and arrow-connected annotations belong to the line they point at — fold them into that card's context, don't drop them.
- Tables / threshold lists (e.g. investment vs turnover limits, classification tiers): make one card per row, or a single card whose answer lays out the rows clearly.
- OCR NOISE: messy cursive produces garbled words. Do NOT hallucinate facts to fill gaps. If a word is garbled but the fact is clear from context, reconstruct it conservatively and add a "corrections" entry flagging it as an uncertain OCR reading. If a line is truly illegible, skip it rather than guess.
- For each card, "source_quote" is the exact OCR line(s) it came from (verbatim, kept short) and "source_highlight" is the key term, acronym, number, date, or formula within that quote.
- "title" is a short, specific headline for the page (3-7 words, no trailing punctuation) that a student would recognise at a glance, e.g. "SEBI & financial regulator updates" or "Cellular respiration — stages & ATP". Not a generic label like "Notes".
- "topic" is the overall subject / category. For a mixed current-affairs page use a broad label (e.g. "Economy & current affairs").
- Set "unreadable": true (with empty arrays) ONLY if MOST of the page is illegible or it clearly is not study notes. A few garbled words do not make it unreadable.`;

/**
 * Structure verbatim OCR text into cards + flagged corrections.
 *
 * Uses the Cloudflare chat model (llama-3.3-70b), NOT sarvam-30b: sarvam-30b is a
 * reasoning model whose thinking alone overruns the 4096-token output ceiling on
 * the starter tier, so it returns an empty completion and never emits the JSON.
 * llama-3.3-70b is a plain instruct model that returns the object directly.
 *
 * Output.object enforces the schema (typed + validated; throws on a bad shape
 * instead of silently mis-parsing). extractJsonMiddleware strips any markdown
 * fences llama wraps the JSON in.
 */
const EMPTY: Extraction = { title: "", topic: "", unreadable: true, items: [], corrections: [] };

async function structureChunk(chunk: string): Promise<Extraction> {
  const model = wrapLanguageModel({ model: chatModel(), middleware: extractJsonMiddleware() });
  try {
    const { output } = await generateText({
      model,
      prompt: `${PROMPT}\n\nTRANSCRIBED NOTES:\n${chunk}`,
      maxOutputTokens: 4096,
      maxRetries: 1, // fail fast: a stuck CF call shouldn't 3x the wall-clock
      output: Output.object({ schema: Extraction }),
    });
    return output;
  } catch (e) {
    console.error("[extract] chunk failed, skipping", e instanceof Error ? e.message : e);
    return EMPTY;
  }
}

// Split OCR text into small line-aligned chunks. The Cloudflare model is slow at
// long JSON output and times out (408) on a big single generation, so we keep
// each chunk small (fast, well under the timeout) and run them in parallel.
export function chunkLines(text: string, maxChars = 800): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (cur.length + line.length + 1 > maxChars && cur.trim()) {
      chunks.push(cur);
      cur = "";
    }
    cur += line + "\n";
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

// Run async tasks with bounded concurrency (avoid hammering the AI gateway).
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Structure verbatim OCR text into cards + flagged corrections. Short notes go
 * in one call; dense multi-fact pages are split into small chunks structured in
 * parallel (≈ slowest chunk, not the sum) and merged — so a "vast" page yields
 * all its cards quickly without hitting Cloudflare's per-request timeout.
 */
export async function structureNotes(ocrText: string): Promise<Extraction> {
  const chunks = chunkLines(ocrText);
  if (chunks.length === 1) return structureChunk(chunks[0]);

  const results = await mapLimit(chunks, 4, structureChunk);
  const items = results.flatMap((r) => r.items);
  const corrections = results.flatMap((r) => r.corrections);
  const topic = results.find((r) => !r.unreadable && r.topic)?.topic ?? "Notes";
  const title = results.find((r) => !r.unreadable && r.title)?.title ?? "";
  return { title, topic, unreadable: items.length === 0, items, corrections };
}
