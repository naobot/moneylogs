import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";
import { storage } from "@/platform";

const checkInCallable = httpsCallable<{ ledgerId: string }, { ok: boolean }>(
  functions,
  "checkInLedger",
);

const key = (userDocId: string) => `ML__buddy_checkin_${userDocId}`;

// Losing the record (private mode, blocked site data) only means checking in again: the
// server counts each day once whatever the client does.
const checkedInToday = (userDocId: string, today: string) => storage.get(key(userDocId)) === today;

const markCheckedIn = (userDocId: string, today: string) => {
  storage.set(key(userDocId), today);
};

/**
 * Opening a financial log checks in for the day (checkInLedger), which keeps up the
 * streak that earns the buddy's coins. At most once a day per person from this browser;
 * the server decides the day and counts it once. A coin shows up through the live finds
 * query, like any find.
 */
export const requestCheckIn = ({
  userDocId,
  ledgerId,
  today,
}: {
  userDocId: string;
  ledgerId: string;
  today: string;
}) => {
  if (checkedInToday(userDocId, today)) return;
  markCheckedIn(userDocId, today);
  checkInCallable({ ledgerId }).catch((error) =>
    reportError(error, { feature: "budget_buddy", action: "check_in", level: "warning" }),
  );
};
