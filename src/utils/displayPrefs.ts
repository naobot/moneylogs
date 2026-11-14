import { useSyncExternalStore } from "react";
import { storage } from "@/platform";

/**
 * Display preferences: how dates/times read and how entry text is set. Like the theme,
 * they are viewing preferences kept per device in local storage, not account data.
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

export const readStoredPrefs = (): DisplayPrefs => {
  const value = storage.getJSON(STORAGE_KEY);
  return value === undefined ? DEFAULT_DISPLAY_PREFS : parsePrefs(value);
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
  storage.setJSON(STORAGE_KEY, current);
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The current display preferences, re-rendering when they change. */
export const useDisplayPrefs = (): DisplayPrefs =>
  useSyncExternalStore(subscribe, getDisplayPrefs, () => DEFAULT_DISPLAY_PREFS);
