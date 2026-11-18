import { useState } from "react";

import RowButton from "@/components/RowButton";
import { useNoSpendDays } from "@/hooks/useNoSpendDays";
import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";

import { confirmNoSpendDay, isAlreadyLogged } from "./noSpendDays";

import "./NoSpendDay.scss";
import { track } from "@/utils/analytics";

export const ALREADY_LOGGED_MESSAGE = "You've logged something today already.";

/**
 * "nothing spent today": the person telling the buddy today was a no-spend day. A day with
 * nothing logged could just be a forgotten one, so only a confirmed day counts (the buddy's
 * cheer and streak, and a quiet lift to luck on the server). Shown on today's month only,
 * and not once they've logged something today in this log; the server checks every log.
 */
export const NoSpendDay = ({ today, loggedToday }: { today: string; loggedToday: boolean }) => {
  const { days, isSuccess } = useNoSpendDays();
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
  if (loggedToday) return null;

  const confirm = async () => {
    setSaving(true);
    try {
      // The confirmed day arrives through the live query, which swaps the button out.
      await confirmNoSpendDay();
      track("no_spend_day");
    } catch (error) {
      if (isAlreadyLogged(error)) {
        showToast(ALREADY_LOGGED_MESSAGE, "error");
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
