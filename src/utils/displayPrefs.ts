import { useSyncExternalStore } from "react";

/**
 * Display preferences: how dates/times read and how entry text is set. Like the theme,
 * they are viewing preferences kept per device in localStorage, not account data.
 * Entry size and alignment reach the CSS as data attributes on <html> (see the
 * --entry-* tokens in src/tokens.scss); date formats are read by src/utils/dateFormat.ts.
 */
export type Clock = "24h" | "12h";
export type DateOrder = "dmy" | "mdy" | "iso";
export type EntrySize = "s" | "m" | "l" | "xl";
export type EntryAlign = "left" | "center" | "justify";

export type DisplayPrefs = {
  clock: Clock;
  dateOrder: DateOrder;
  entrySize: EntrySize;
  entryAlign: EntryAlign;
};

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  clock: "24h",
  dateOrder: "dmy",
  entrySize: "m",
  entryAlign: "left",
};

export const CLOCKS: readonly Clock[] = ["24h", "12h"];
export const DATE_ORDERS: readonly DateOrder[] = ["dmy", "mdy", "iso"];
export const ENTRY_SIZES: readonly EntrySize[] = ["s", "m", "l", "xl"];
export const ENTRY_ALIGNS: readonly EntryAlign[] = ["left", "center", "justify"];

export const STORAGE_KEY = "ML__display";
const listeners = new Set<() => void>();
let current: DisplayPrefs = DEFAULT_DISPLAY_PREFS;

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Validates each field on its own, so one bad value doesn't reset the rest. */
export const parsePrefs = (raw: unknown): DisplayPrefs => {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_DISPLAY_PREFS;
  return {
    clock: pick(CLOCKS, source.clock, d.clock),
    dateOrder: pick(DATE_ORDERS, source.dateOrder, d.dateOrder),
    entrySize: pick(ENTRY_SIZES, source.entrySize, d.entrySize),
    entryAlign: pick(ENTRY_ALIGNS, source.entryAlign, d.entryAlign),
  };
};

// Storage can throw (private mode, blocked site data); these are conveniences.
export const readStoredPrefs = (): DisplayPrefs => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value) return parsePrefs(JSON.parse(value));
  } catch {
    // ignore
  }
  return DEFAULT_DISPLAY_PREFS;
};

const applyToDocument = (prefs: DisplayPrefs) => {
  const { dataset } = document.documentElement;
  if (prefs.entrySize === DEFAULT_DISPLAY_PREFS.entrySize) delete dataset.entrySize;
  else dataset.entrySize = prefs.entrySize;
  if (prefs.entryAlign === DEFAULT_DISPLAY_PREFS.entryAlign) delete dataset.entryAlign;
  else dataset.entryAlign = prefs.entryAlign;
};

/** Call once before the first render so entries never flash at the wrong size. */
export const initDisplayPrefs = () => {
  current = readStoredPrefs();
  applyToDocument(current);
};

export const getDisplayPrefs = (): DisplayPrefs => current;

export const setDisplayPrefs = (changes: Partial<DisplayPrefs>) => {
  current = parsePrefs({ ...current, ...changes });
  applyToDocument(current);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The current display preferences, re-rendering when they change. */
export const useDisplayPrefs = (): DisplayPrefs =>
  useSyncExternalStore(subscribe, getDisplayPrefs, () => DEFAULT_DISPLAY_PREFS);
