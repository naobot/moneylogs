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

export const LEDGER_TOUR_STEPS: readonly LedgerTourStep[] = [
  { target: "amount", text: "This is your personal log. Type what you spent here." },
  {
    target: "currency",
    text: "It starts on your default currency. Switch it for anything you paid in another.",
  },
  { target: "category", text: "Pick a category so your totals add up by kind.", align: "end" },
  {
    target: "date",
    text: "Today by default. Change it to log a late receipt.",
    align: "start",
  },
  { target: "note", text: "Add a note if you like, then press Enter or Add to save it." },
  { target: "month", text: "Entries are kept by month. Flip between them here." },
  { target: "stats", text: "Totals, trends and budgets live in stats.", align: "end" },
  {
    target: "categories",
    text: "Rename categories and set monthly budgets here.",
    align: "end",
  },
  {
    target: "buddy",
    text: "Your budget buddy keeps an eye on the month. Tap it any time.",
  },
];

type TourUser = {
  userId: string;
  onboardingPending?: boolean;
  tutorials?: { ledgerTour?: unknown; ledgerNudge?: unknown };
};

/**
 * Whether to run the tour on this ledger: it's the user's own personal log, it's still
 * empty, and they've neither finished nor skipped the tour (on any device). `hasEntries`
 * is undefined while unknown, which never shows it.
 */
export const shouldShowLedgerTour = ({
  user,
  ledgerId,
  hasEntries,
}: {
  user: TourUser | undefined;
  ledgerId: string;
  hasEntries: boolean | undefined;
}): boolean =>
  !!user &&
  !user.onboardingPending &&
  !user.tutorials?.ledgerTour &&
  ledgerId === personalLedgerId(user.userId) &&
  hasEntries === false;

/**
 * Whether Home should point at the personal log: the same as the tour, plus the log must
 * still be one of theirs (deleted personal logs stay deleted) and the nudge not yet
 * dismissed or followed.
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
  if (!user || user.tutorials?.ledgerNudge) return false;
  const id = personalLedgerId(user.userId);
  return ledgerIds.includes(id) && shouldShowLedgerTour({ user, ledgerId: id, hasEntries });
};
