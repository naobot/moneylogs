import { useSyncExternalStore } from "react";
import { storage } from "@/platform";

/**
 * Display theme. Every theme is one pair of inks: "paper" is ink on paper, "night"
 * (Night shift) the same two inks swapped, and the colour themes bring their own pair.
 * Kept per device in local storage: it is a viewing preference, not account data. The
 * CSS lives in src/tokens.scss under :root[data-theme="<id>"] (Paper has no attribute).
 */
export const COLOUR_THEMES = ["amber", "blueprint", "riso"] as const;
export type ColourTheme = (typeof COLOUR_THEMES)[number];
export type Theme = "paper" | "night" | ColourTheme;

/** Whether text sits on a light or a dark ground. */
export type ThemeTone = "light" | "dark";

export const THEMES: Record<Theme, { label: string; tone: ThemeTone }> = {
  paper: { label: "Paper", tone: "light" },
  night: { label: "Night shift", tone: "dark" },
  amber: { label: "Amber CRT", tone: "dark" },
  blueprint: { label: "Blueprint", tone: "dark" },
  riso: { label: "Riso", tone: "light" },
};

export const THEME_LABELS = Object.fromEntries(
  Object.entries(THEMES).map(([id, { label }]) => [id, label]),
) as Record<Theme, string>;

const STORAGE_KEY = "ML__theme";
/** The last colour theme picked, which the star stands for. */
const COLOUR_STORAGE_KEY = "ML__theme_colour";
const listeners = new Set<() => void>();
let current: Theme = "paper";
let lastColour: ColourTheme | null = null;

const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(THEMES, value);

export const isColourTheme = (value: unknown): value is ColourTheme =>
  (COLOUR_THEMES as readonly unknown[]).includes(value);

export const themeTone = (theme: Theme): ThemeTone => THEMES[theme].tone;

export const readStoredTheme = (): Theme => {
  const value = storage.get(STORAGE_KEY);
  return isTheme(value) ? value : "paper";
};

const readStoredColourTheme = (): ColourTheme | null => {
  const value = storage.get(COLOUR_STORAGE_KEY);
  return isColourTheme(value) ? value : null;
};

const applyToDocument = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "paper") delete root.dataset.theme;
  else root.dataset.theme = theme;
};

/** Call once before the first render so the page never flashes the wrong theme. */
export const initTheme = () => {
  current = readStoredTheme();
  lastColour = isColourTheme(current) ? current : readStoredColourTheme();
  applyToDocument(current);
};

export const getTheme = (): Theme => current;

/** The last colour theme used on this device, or null if none ever was. */
export const getLastColourTheme = (): ColourTheme | null => lastColour;

export const setTheme = (theme: Theme) => {
  current = theme;
  applyToDocument(theme);
  storage.set(STORAGE_KEY, theme);
  if (isColourTheme(theme)) {
    lastColour = theme;
    storage.set(COLOUR_STORAGE_KEY, theme);
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The current theme, re-rendering when it changes. */
export const useTheme = (): Theme => useSyncExternalStore(subscribe, getTheme, () => "paper");

/** The last colour theme used (what the star stands for), re-rendering when it changes. */
export const useLastColourTheme = (): ColourTheme | null =>
  useSyncExternalStore(subscribe, getLastColourTheme, () => null);

/**
 * The theme the top-bar toggle switches to: Paper → ★ (last colour theme) → Night shift
 * → Paper. Without the star (no colour theme used yet, or signed out) it is Paper ↔ Night,
 * and a colour theme moves on to Night as if the star were still in the cycle.
 */
export const nextToggleTheme = (
  theme: Theme,
  { includeStar, lastColour }: { includeStar: boolean; lastColour: ColourTheme | null },
): Theme => {
  if (theme === "paper") return includeStar && lastColour ? lastColour : "night";
  if (theme === "night") return "paper";
  return "night";
};

/**
 * The markdown editor/preview (`data-color-mode`) needs to know whether its text sits on
 * a light or dark ground: dark on an inverted block in a light theme, and on the ground
 * in a dark one.
 */
export const markdownColorMode = (theme: Theme, inverted = false): "light" | "dark" =>
  (themeTone(theme) === "dark") !== inverted ? "dark" : "light";
