import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";
import { storage } from "@/platform";

const confirmNoSpendDayCallable = httpsCallable<void, { ok: true }>(functions, "confirmNoSpendDay");

/**
 * Tell the server today (in the person's timezone, decided there) was a no-spend day.
 * Rejected with "failed-precondition" if they've logged anything dated today in any log.
 */
export const confirmNoSpendDay = () => confirmNoSpendDayCallable();

/** Whether a callable error means "you've logged something today already". */
export const isAlreadyLogged = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "functions/failed-precondition";

// The buddy cheers a confirmed day once, whichever log it's opened in. One key holding the
// last day cheered; losing it (private mode) only means it might cheer twice.
const CHEER_KEY = "ML__buddy_nospend";

export const cheeredNoSpend = (day: string): boolean => storage.get(CHEER_KEY) === day;

export const markCheeredNoSpend = (day: string) => {
  storage.set(CHEER_KEY, day);
};
