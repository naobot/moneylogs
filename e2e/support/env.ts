import path from "node:path";

/** The walkthroughs run their own dev server, away from the one you develop against. */
export const E2E_PORT = 5174;
export const BASE_URL = `http://localhost:${E2E_PORT}`;

/** Screenshots, notes and the contact sheet (index.html). Not committed. */
export const OUTPUT_DIR = path.resolve(import.meta.dirname, "../.output");
export const SCREENS_DIR = path.join(OUTPUT_DIR, "screens");
export const NOTES_DIR = path.join(OUTPUT_DIR, "notes");

/** Each walkthrough runs once per variant: a phone in each ink. */
export const VARIANTS = [
  { id: "phone-day", theme: "paper" },
  { id: "phone-night", theme: "night" },
] as const;
export type Variant = (typeof VARIANTS)[number];

export const PHONE = { width: 390, height: 844 };
/** The timezone the browser reports, which the welcome wizard guesses from. */
export const BROWSER_TIMEZONE = "America/Vancouver";
