import dayjs from "@/utils/configuredDayjs";
import { useCurrentUser } from "@/contexts";
import { useLedgerMonths } from "@/hooks/useLedgerMonths";
import { useNoSpendDays } from "@/hooks/useNoSpendDays";
import { useNow } from "@/hooks/useNow";
import { Ledger } from "@/types/ledger";
import { shiftMonth, todayInTz } from "@/utils/ledger";
import { buddyMood } from "./buddyMood";

const localHourIn = (now: dayjs.Dayjs, timezone?: string | null): number => {
  try {
    return (timezone ? now.tz(timezone) : now).hour();
  } catch {
    return now.hour();
  }
};

/**
 * The buddy's state for a log right now, in the viewer's timezone: the same mood, seed and
 * sleep the log's buddy shows, for anything that needs to match it (the buddy itself, share
 * cards). `isSuccess` is false until the month docs and no-spend days are in, so the face
 * doesn't flash from idle.
 */
export const useBuddyMood = (ledger: Pick<Ledger, "id" | "categories" | "monthlyBudget">) => {
  const { user } = useCurrentUser();
  const now = useNow();
  const today = todayInTz(user?.timezone, now.valueOf());
  const month = today.slice(0, 7);
  const localHour = localHourIn(now, user?.timezone);

  const previousMonth = shiftMonth(month, -1);
  const { byMonth, isSuccess: monthsLoaded } = useLedgerMonths({
    ledgerId: ledger.id,
    from: previousMonth,
    to: month,
  });

  // Only confirmed days count as no-spend: an unlogged day may just have been forgotten.
  const noSpend = useNoSpendDays();
  // Both have to be in: without the no-spend days, an already confirmed day looks
  // unconfirmed.
  const isSuccess = monthsLoaded && noSpend.isSuccess;

  // Cheap enough to work out on every render: two month docs and a few categories.
  const state = buddyMood({
    ledgerId: ledger.id,
    categories: ledger.categories ?? [],
    monthlyBudget: ledger.monthlyBudget,
    current: byMonth[month],
    previous: byMonth[previousMonth],
    today,
    localHour,
    confirmedNoSpend: noSpend.days,
  });

  return { state, today, month, previousMonth, localHour, byMonth, noSpend, isSuccess };
};
