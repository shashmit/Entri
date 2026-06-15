"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

function systemTheme(): "light" | "dark" {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem("entri-theme");
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "system";
}

export function applyMode(mode: ThemeMode) {
  const resolved = mode === "system" ? systemTheme() : mode;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function writeMode(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem("entri-theme");
    else localStorage.setItem("entri-theme", mode);
  } catch {}
  applyMode(mode);
}

/**
 * Global, UI-less watcher mounted once in the layout: applies the stored
 * mode on load and follows OS theme changes live while in "system" mode.
 * Re-reads storage at event time, so it never fights an explicit choice
 * made elsewhere (e.g. the settings page).
 */
export function useThemeWatcher() {
  useEffect(() => {
    applyMode(readMode());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readMode() === "system") applyMode("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
}

/** Theme mode state + setter for settings UI. */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    setModeState(readMode());
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    writeMode(next);
    setModeState(next);
  }, []);

  return { mode, setMode };
}
