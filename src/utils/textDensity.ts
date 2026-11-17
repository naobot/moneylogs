/**
 * How much text a page can afford on a phone. "Roomy" pages are mostly reading (the
 * landing page, /about, /me, Home, notifications) and get full-size text; "dense" pages
 * pack in posts, entries, tables and form steps, so they stay a step smaller to fit.
 * Layout puts this on .Content as data-text (see App.scss).
 */
export type TextDensity = "roomy" | "dense";

// A log's own page and its sub-pages, except the invite pages, which are mostly reading.
const DENSE = [/^\/g\/[^/]+\/?$/, /^\/l\/[^/]+(\/stats)?\/?$/, /^\/create\/?$/];

export const textDensity = (pathname: string): TextDensity =>
  DENSE.some((pattern) => pattern.test(pathname)) ? "dense" : "roomy";
