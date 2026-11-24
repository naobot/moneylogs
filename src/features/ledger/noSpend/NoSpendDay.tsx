import { useState } from "react";

import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { CHECK_IN_FROM_HOUR } from "@/features/ledger/buddy/buddyCheckIn";
import { useNow } from "@/hooks/useNow";
import { useNoSpendDays } from "@/hooks/useNoSpendDays";
import { useLoggedOnDayElsewhere } from "@/hooks/useLoggedOnDayElsewhere";
import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";
import { whileHoldingNavigation } from "@/utils/navigationHold";
import { hourInTz } from "@/utils/ledger";

import {
  alreadyLoggedIn,
  alreadyLoggedMessage,
  confirmNoSpendDay,
  isAlreadyLogged,
} from "./noSpendDays";

import "./NoSpendDay.scss";
import { track } from "@/utils/analytics";

/**
 * "nothing spent today": the person telling the buddy today was a no-spend day. A day with
 * nothing logged could just be a forgotten one, so only a confirmed day counts (the buddy's
 * cheer and streak, and a quiet lift to luck on the server). Shown on today's month only.
 * The day is the person's, not this log's: it's not offered once they've logged something
 * today here or in any of their other logs, and the server checks again on confirming.
 * Nor before 17:00 in their timezone: a day isn't no-spend until most of it is over. That's
 * when the buddy starts asking about it too.
 */
export const NO_SPEND_FROM_HOUR = CHECK_IN_FROM_HOUR;

export const NoSpendDay = ({
  ledgerId,
  today,
  loggedToday,
}: {
  ledgerId: string;
  today: string;
  loggedToday: boolean;
}) => {
  const { user } = useCurrentUser();
  // Re-renders each minute, so an open log offers the button once 17:00 comes round.
  const now = useNow();
  const evening = hourInTz(user?.timezone, now.valueOf()) >= NO_SPEND_FROM_HOUR;
  const { days, isSuccess } = useNoSpendDays();
  const other = useLoggedOnDayElsewhere({
    ledgerId,
    day: today,
    enabled: evening && !loggedToday,
  });
  const { showToast } = useToastContext();
  const [saving, setSaving] = useState(false);

  // Nothing until the confirmed days load, so a confirmed day doesn't flash as a button.
  if (!isSuccess) return null;

  if (days.has(today)) {
    return (
      <p className="NoSpendDay NoSpendDay--confirmed">
        today&apos;s a no-spend day
        <span className="NoSpendDay__tick" aria-hidden="true">
          ✓
        </span>
      </p>
    );
  }
  // Not while the other logs are being checked either, so the button doesn't flash.
  if (!evening || loggedToday || other.isLoading || other.elsewhere !== null) return null;

  const confirm = async () => {
    setSaving(true);
    try {
      // The confirmed day arrives through the live query, which swaps the button out.
      // Stay on this log until the server answers, so the confirmation, the buddy's cheer
      // or an error doesn't turn up in another log.
      await whileHoldingNavigation(confirmNoSpendDay);
      track("no_spend_day");
    } catch (error) {
      if (isAlreadyLogged(error)) {
        showToast(alreadyLoggedMessage(alreadyLoggedIn(error)), "error");
      } else {
        reportError(error, { feature: "no_spend_day", action: "confirm" });
        showToast("Couldn't save that. Please try again.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="NoSpendDay">
      <RowButton onClick={() => void confirm()} disabled={saving}>
        nothing spent today
      </RowButton>
    </div>
  );
};

export default NoSpendDay;
