// Thin client for the entri Hono API. Sends the InsForge access token (the
// browser-readable `insforge_access_token` cookie) as a Bearer; on a 401 it
// refreshes once through /api/auth/refresh and retries.
import type { ZodType } from "zod";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

// `schema` (optional) validates the JSON response at runtime against the shared
// @entri/types contract — a malformed/drifted payload throws here instead of
// surfacing as a confusing render bug later.
async function apiFetch<T>(path: string, init?: RequestInit, schema?: ZodType<T>): Promise<T> {
  const run = (token: string | null) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

  let res = await run(readCookie("insforge_access_token"));
  if (res.status === 401) {
    await fetch("/api/auth/refresh", { method: "POST" });
    res = await run(readCookie("insforge_access_token"));
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `API ${res.status}`);
  }
  if (res.status === 204) return null as T;
  const json = await res.json();
  return schema ? schema.parse(json) : (json as T);
}

export const api = {
  get: <T>(path: string, schema?: ZodType<T>) => apiFetch<T>(path, undefined, schema),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T = null>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

// Returns the raw Response so callers can read a stream + headers (e.g. chat).
// Same Bearer + refresh-on-401-retry behaviour as apiFetch.
export async function apiStream(path: string, body: unknown): Promise<Response> {
  const run = (token: string | null) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  let res = await run(readCookie("insforge_access_token"));
  if (res.status === 401) {
    await fetch("/api/auth/refresh", { method: "POST" });
    res = await run(readCookie("insforge_access_token"));
  }
  return res;
}
