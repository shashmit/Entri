"use client";

import { useCallback, useEffect, useState } from "react";
import type { ZodType } from "zod";
import { api } from "./api";

// Minimal GET hook: fetches on mount (and when `path` changes), exposes
// loading/error/refetch. Pass null to skip. Pass a zod schema to validate the
// response against the shared @entri/types contract (T is inferred from it).
export function useGet<T>(path: string | null, schema?: ZodType<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (path === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await api.get<T>(path, schema));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [path, schema]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (path === null) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const d = await api.get<T>(path, schema);
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, schema]);

  return { data, loading, error, refetch: load };
}
