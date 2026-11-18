import { useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { reportError } from "@/utils/reportError";
import { storage } from "@/platform";
import { hourInTz, todayInTz } from "@/utils/ledger";

const dailyCheckInCallable = httpsCallable<void, { ok: boolean; more: boolean }>(
  functions,
  "dailyCheckIn",
);

/** The evening roll opens at this hour (functions/src/knickknacks.ts EVENING_FROM_HOUR). */
export const EVENING_FROM_HOUR = 17;

/** When to ask next: { day, hour } means "not before this local hour on this day". */
type NextAsk = { day: string; hour: number };

const key = (userDocId: string) => `ML__checkin_next_${userDocId}`;

const readNext = (userDocId: string): NextAsk | null => {
  try {
    const parsed = JSON.parse(storage.get(key(userDocId)) ?? "null") as NextAsk | null;
    return parsed && typeof parsed.day === "string" && typeof parsed.hour === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
};

/** Whether to ask the server now, given when it last said to ask next. */
export const shouldAsk = (next: NextAsk | null, today: string, hour: number): boolean =>
  !next || next.day !== today || hour >= next.hour;

/**
 * When to ask next after the server answers: tomorrow when today's visit rolls are spent;
 * otherwise the evening, or (in the evening, or when the day couldn't start yet) an hour on.
 */
export const nextAsk = ({
  more,
  today,
  hour,
}: {
  more: boolean;
  today: string;
  hour: number;
}): NextAsk => {
  if (!more) return { day: today, hour: 24 };
  return { day: today, hour: hour < EVENING_FROM_HOUR ? EVENING_FROM_HOUR : hour + 1 };
};

let inFlight = false;

/**
 * A signed-in visit is the day's check-in (dailyCheckIn): it keeps up the streak that earns
 * coins, moves luck, and rolls the day's visit chance at a knick-knack, then the evening
 * one. The server decides the day and what's still open; this only avoids asking when
 * there's nothing to gain. Losing the record (private mode) only means asking again.
 */
export const requestDailyCheckIn = ({
  userDocId,
  today,
  hour,
}: {
  userDocId: string;
  today: string;
  hour: number;
}) => {
  if (inFlight || !shouldAsk(readNext(userDocId), today, hour)) return;
  inFlight = true;
  dailyCheckInCallable()
    .then(({ data }) =>
      storage.set(key(userDocId), JSON.stringify(nextAsk({ more: data.more, today, hour }))),
    )
    .catch((error) =>
      reportError(error, { feature: "budget_buddy", action: "daily_check_in", level: "warning" }),
    )
    .finally(() => {
      inFlight = false;
    });
};

/**
 * Checks in for a signed-in person with an account set up: when the app opens, and each
 * time it comes back into view (so a tab left open into the evening still gets its roll).
 */
export const useDailyCheckIn = () => {
  const { user } = useCurrentUser();
  const userDocId = user && !user.onboardingPending ? user.id : undefined;
  const timezone = user?.timezone;

  useEffect(() => {
    if (!userDocId) return;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      requestDailyCheckIn({
        userDocId,
        today: todayInTz(timezone),
        hour: hourInTz(timezone),
      });
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [userDocId, timezone]);
};
