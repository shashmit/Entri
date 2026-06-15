import { SarvamAIClient } from "sarvamai";
import JSZip from "jszip";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

// Sarvam Vision (Document Intelligence) — handwriting/Indic OCR. Async job API:
// input must be a single PDF or a ZIP of JPEG/PNG images, output is a ZIP of
// per-page Markdown. Verbatim transcription only — the structuring step
// (sarvam-30b, in extract.ts) turns the text into cards and flags corrections,
// so the student's words are never silently rewritten.

export function sarvamConfigured(): boolean {
  return Boolean(env.SARVAM_API_KEY);
}

let _client: SarvamAIClient | null = null;
function client(): SarvamAIClient {
  if (!sarvamConfigured()) throw new Error("Sarvam not configured: set SARVAM_API_KEY");
  if (!_client) _client = new SarvamAIClient({ apiSubscriptionKey: env.SARVAM_API_KEY! });
  return _client;
}

// Run one Document Intelligence job for a single input file (PDF or image ZIP)
// and return its concatenated per-page Markdown.
async function digitize(file: File): Promise<string> {
  const c = client();
  const language = env.SARVAM_OCR_LANGUAGE;

  const job = await c.documentIntelligence.createJob(
    { language, outputFormat: "md" } as Parameters<typeof c.documentIntelligence.createJob>[0]
  );
  await job.uploadFile(file);
  await job.start();
  const status = await job.waitUntilComplete();
  if (status.job_state === "Failed") {
    throw new Error(`Sarvam OCR failed: ${status.error_message ?? "unknown error"}`);
  }

  const outPath = join(tmpdir(), `entri-ocr-${randomUUID()}.zip`);
  try {
    await job.downloadOutput(outPath);
    const out = await JSZip.loadAsync(await readFile(outPath));
    const mdNames = Object.keys(out.files)
      .filter((n) => n.toLowerCase().endsWith(".md"))
      .sort();
    let md = "";
    for (const n of mdNames) md += (await out.files[n].async("string")) + "\n\n";
    return md.trim();
  } finally {
    await unlink(outPath).catch(() => {});
  }
}

export type OcrFile = { bytes: Uint8Array; isPdf: boolean };

/**
 * OCR a note's files. Images are batched into one ZIP job; each PDF is its own
 * job (Sarvam takes one PDF *or* one image-ZIP per job). Markdown is concatenated.
 */
export async function ocr(files: OcrFile[]): Promise<string> {
  const parts: string[] = [];

  const images = files.filter((f) => !f.isPdf);
  if (images.length) {
    const zip = new JSZip();
    images.forEach((f, i) => zip.file(`page${String(i).padStart(3, "0")}.jpg`, f.bytes));
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    parts.push(await digitize(new File([zipBuf], "pages.zip", { type: "application/zip" })));
  }

  const pdfs = files.filter((f) => f.isPdf);
  for (let i = 0; i < pdfs.length; i++) {
    parts.push(await digitize(new File([pdfs[i].bytes], `doc${i}.pdf`, { type: "application/pdf" })));
  }

  return parts.filter(Boolean).join("\n\n").trim();
}
