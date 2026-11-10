import { useSyncExternalStore } from "react";

/**
 * Display theme. "paper" is ink on paper; "night" (Night shift) is the same two inks
 * swapped. Kept per device in localStorage: it is a viewing preference, not account
 * data. The CSS lives in src/tokens.scss under :root[data-theme="night"].
 */
export type Theme = "paper" | "night";

const STORAGE_KEY = "ML__theme";
const listeners = new Set<() => void>();
let current: Theme = "paper";

const isTheme = (value: unknown): value is Theme => value === "paper" || value === "night";

// Storage can throw (private mode, blocked site data); the theme is a convenience.
export const readStoredTheme = (): Theme => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(value)) return value;
  } catch {
    // ignore
  }
  return "paper";
};

const applyToDocument = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "night") root.dataset.theme = "night";
  else delete root.dataset.theme;
};

/** Call once before the first render so the page never flashes the wrong theme. */
export const initTheme = () => {
  current = readStoredTheme();
  applyToDocument(current);
};

export const getTheme = (): Theme => current;

export const setTheme = (theme: Theme) => {
  current = theme;
  applyToDocument(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The current theme, re-rendering when it changes. */
export const useTheme = (): Theme => useSyncExternalStore(subscribe, getTheme, () => "paper");

/**
 * The markdown editor/preview (`data-color-mode`) needs to know whether its text sits on
 * a light or dark ground: dark on an inverted block in Paper, and on the ground in Night.
 */
export const markdownColorMode = (theme: Theme, inverted = false): "light" | "dark" =>
  (theme === "night") !== inverted ? "dark" : "light";
