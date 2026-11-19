import { personalLedgerId } from "@/utils/personalLedger";

/** Places on the ledger page a tour tip can point at. */
export type LedgerTourTarget =
  | "amount"
  | "currency"
  | "category"
  | "date"
  | "note"
  | "month"
  | "stats"
  | "categories"
  | "buddy";

export type LedgerTourStep = {
  target: LedgerTourTarget;
  text: string;
  /** Which way the bubble points; "top" sits above its anchor. */
  position?: "top" | "bottom";
  /** Pin the bubble to an edge of its anchor when the anchor sits at a screen edge. */
  align?: "center" | "start" | "end";
};

/** The tour for a log. Only the opening tips differ between the personal log and others. */
export const ledgerTourSteps = (isPersonal: boolean): readonly LedgerTourStep[] => [
  isPersonal
    ? { target: "amount", text: "This is your personal log. Type what you spent here." }
    : { target: "amount", text: "Type what you spent here. Everyone in this log sees it." },
  {
    target: "currency",
    text: isPersonal
      ? "It starts on your default currency. Switch it for anything you paid in another."
      : "It starts on this log's currency. Switch it for anything you paid in another.",
  },
  { target: "category", text: "Pick a category so your totals add up by kind.", align: "end" },
  {
    target: "date",
    text: "Today by default. Change it to log a late receipt.",
    align: "start",
  },
  { target: "note", text: "Add a note if you like, then press Enter or Add to save it." },
  { target: "month", text: "Entries are kept by month. Flip between them here." },
  {
    target: "stats",
    text: "Totals, trends and budgets live in stats, by month, quarter or year.",
    align: "start",
  },
  {
    target: "categories",
    text: "Rename, reorder and add categories here.",
    align: "end",
  },
  {
    target: "buddy",
    text: "Your budget buddy keeps an eye on the month. Tap it any time.",
  },
];

/**
 * Logs created from this day on run the tour for everyone in them. Older shared logs don't,
 * so existing members aren't toured through logs they already know. The personal log
 * always runs it once.
 */
export const TOUR_NEW_LOGS_SINCE = Date.UTC(2026, 10, 18);

type TourUser = {
  userId: string;
  onboardingPending?: boolean;
  tutorials?: {
    ledgerTours?: Record<string, unknown>;
    ledgerNudge?: unknown;
    /** The old one-per-account record. Ignored: everyone sees the per-log tour once more. */
    ledgerTour?: unknown;
  };
};

type TourLedger = {
  id: string;
  /** Missing (or null while the server timestamp is pending) on a log just created. */
  createdAt?: { toMillis: () => number } | null;
};

const isNewLog = (ledger: TourLedger) =>
  !ledger.createdAt || ledger.createdAt.toMillis() >= TOUR_NEW_LOGS_SINCE;

/**
 * Whether to run the tour on this log: it's the user's own personal log or a log made since
 * the tour went per-log, and they haven't finished or skipped it there (on any device).
 * It runs whether or not the log has entries yet.
 */
export const shouldShowLedgerTour = ({
  user,
  ledger,
}: {
  user: TourUser | undefined;
  ledger: TourLedger;
}): boolean =>
  !!user &&
  !user.onboardingPending &&
  !user.tutorials?.ledgerTours?.[ledger.id] &&
  (ledger.id === personalLedgerId(user.userId) || isNewLog(ledger));

/**
 * Whether Home should point at the personal log: it's still one of theirs (deleted personal
 * logs stay deleted), still empty (it says "your personal log is ready"), not yet toured,
 * and the nudge not yet dismissed or followed. `hasEntries` is undefined while unknown,
 * which never shows it.
 */
export const shouldShowLedgerNudge = ({
  user,
  ledgerIds,
  hasEntries,
}: {
  user: TourUser | undefined;
  ledgerIds: readonly string[];
  hasEntries: boolean | undefined;
}): boolean => {
  if (!user || user.onboardingPending || user.tutorials?.ledgerNudge) return false;
  const id = personalLedgerId(user.userId);
  return ledgerIds.includes(id) && !user.tutorials?.ledgerTours?.[id] && hasEntries === false;
};
