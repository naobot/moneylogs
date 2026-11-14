import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";
import { storage } from "@/platform";

const rollQuietDayCallable = httpsCallable<{ ledgerId: string }, { ok: boolean }>(
  functions,
  "rollQuietDay",
);

const key = (userDocId: string) => `ML__buddy_quietroll_${userDocId}`;

// Losing the record only means asking again: the server allows one roll a day whatever
// the client does.
const askedToday = (userDocId: string, today: string) => storage.get(key(userDocId)) === today;

const markAsked = (userDocId: string, today: string) => {
  storage.set(key(userDocId), today);
};

/**
 * On an evening with nothing logged, ask the server for the day's knick-knack roll
 * (rollQuietDay). At most once a day per person from this browser; the server checks
 * the time, membership, and that the day's roll is still unspent. A find shows up
 * through the live finds query, like any other.
 */
export const requestQuietDayRoll = ({
  userDocId,
  ledgerId,
  today,
}: {
  userDocId: string;
  ledgerId: string;
  today: string;
}) => {
  if (askedToday(userDocId, today)) return;
  markAsked(userDocId, today);
  rollQuietDayCallable({ ledgerId }).catch((error) =>
    console.error("The buddy's quiet-day roll failed:", error),
  );
};
