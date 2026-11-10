import { useMemo } from "react";
import type { Dayjs } from "dayjs";
import { DisplayPrefs, getDisplayPrefs, useDisplayPrefs } from "@/utils/displayPrefs";

/**
 * Display formatting for dates and times, following the viewer's clock and date-order
 * preferences. Only for text people read: keys, ids and input values keep fixed formats
 * ("YYYY-MM-DD", "YYYY-MM", datetime-local) and must never go through these.
 *
 * Every formatter takes the preferences last, defaulting to the current ones, so pure
 * utils can call them without threading prefs through; components should use
 * useDateFormat() so they re-render when the preferences change.
 */
export type DateOptions = { weekday?: boolean; year?: boolean };

/** 14:05 or 2:05pm. */
export const formatTime = (d: Dayjs, prefs: DisplayPrefs = getDisplayPrefs()): string =>
  d.format(prefs.clock === "12h" ? "h:mma" : "HH:mm");

const datePattern = ({ weekday = true, year = true }: DateOptions, prefs: DisplayPrefs) => {
  const day = weekday ? "ddd " : "";
  switch (prefs.dateOrder) {
    case "iso":
      return `${day}${year ? "YYYY-MM-DD" : "MM-DD"}`;
    case "mdy":
      return `${day}${year ? "MMM D, YYYY" : "MMM D"}`;
    default:
      return `${day}${year ? "D MMM YYYY" : "D MMM"}`;
  }
};

/** Tue 4 Nov 2026 · Tue Nov 4, 2026 · Tue 2026-11-04 (weekday and year optional). */
export const formatDate = (
  d: Dayjs,
  options: DateOptions = {},
  prefs: DisplayPrefs = getDisplayPrefs(),
): string => d.format(datePattern(options, prefs));

/** A date followed by a time, e.g. Tue 4 Nov 2026 14:05. */
export const formatDateTime = (
  d: Dayjs,
  options: DateOptions = {},
  prefs: DisplayPrefs = getDisplayPrefs(),
): string => `${formatDate(d, options, prefs)} ${formatTime(d, prefs)}`;

/** 4 Nov · Nov 4 · 11-04: chart axes and compact ranges. */
export const formatShortDate = (d: Dayjs, prefs: DisplayPrefs = getDisplayPrefs()): string =>
  formatDate(d, { weekday: false, year: false }, prefs);

/** Nov 2026 (or Nov 26 with `short`) · 2026-11 for ISO. */
export const formatMonth = (
  d: Dayjs,
  { short = false }: { short?: boolean } = {},
  prefs: DisplayPrefs = getDisplayPrefs(),
): string => d.format(prefs.dateOrder === "iso" ? "YYYY-MM" : short ? "MMM YY" : "MMM YYYY");

/** The formatters bound to the current preferences; re-renders when they change. */
export const useDateFormat = () => {
  const prefs = useDisplayPrefs();
  return useMemo(
    () => ({
      prefs,
      formatTime: (d: Dayjs) => formatTime(d, prefs),
      formatDate: (d: Dayjs, options?: DateOptions) => formatDate(d, options, prefs),
      formatDateTime: (d: Dayjs, options?: DateOptions) => formatDateTime(d, options, prefs),
      formatShortDate: (d: Dayjs) => formatShortDate(d, prefs),
      formatMonth: (d: Dayjs, options?: { short?: boolean }) => formatMonth(d, options, prefs),
    }),
    [prefs],
  );
};
