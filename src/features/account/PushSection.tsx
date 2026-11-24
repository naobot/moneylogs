import { useEffect, useState } from "react";
import { LoadingDots } from "@/components/LoadingDots";

import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { PushState, readPushState, turnPushOff, turnPushOn } from "@/features/push/devicePush";
import { reportError } from "@/utils/reportError";

import { updateUserFields } from "@/hooks/useUserQuery";

import "./DisplaySection.scss";
import "./NotificationsSection.scss";

const PUSH_LABELS: Record<PushState, string> = {
  on: "On",
  off: "Off",
  blocked: "Off in phone settings",
};

/**
 * Push notifications on this phone (native app only). Nothing is asked of the OS until
 * the person turns it on here. What gets pushed follows the same per-type preferences
 * as the inbox, plus the evening reminder (functions/src/eveningReminder.ts), which is
 * push only and has its own switch here.
 */
export const PushSection = ({ onChange }: { onChange?: (state: PushState) => void }) => {
  const { user } = useCurrentUser();
  const { showToast } = useToastContext();
  const [state, setState] = useState<PushState | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void readPushState().then(setState);
  }, []);

  const update = (next: PushState) => {
    setState(next);
    onChange?.(next);
  };

  const toggle = async () => {
    if (!user?.id || pending) return;
    setPending(true);
    try {
      if (state === "on") {
        await turnPushOff(user.id);
        update("off");
      } else {
        update(await turnPushOn(user.id));
      }
    } catch (err) {
      reportError(err, { feature: "push", action: state === "on" ? "turn_off" : "turn_on" });
      showToast("Couldn't change push notifications. Please try again.", "error");
    } finally {
      setPending(false);
    }
  };

  const reminderOn = user?.checkInReminder !== false;
  const setReminder = async (on: boolean) => {
    if (!user?.id) return;
    try {
      await updateUserFields(user.id, { checkInReminder: on });
    } catch (err) {
      reportError(err, { feature: "push", action: "toggle_evening_reminder" });
      showToast("Couldn't save that setting. Please try again.", "error");
    }
  };

  return (
    <section className="PushSection NotificationsSection__group">
      <h3>push notifications</h3>
      <div className="DisplaySection__row">
        <span className="DisplaySection__label">on this phone</span>
        <span>{state ? PUSH_LABELS[state] : <LoadingDots />}</span>
        {state && state !== "blocked" && (
          <RowButton onClick={() => void toggle()} disabled={pending}>
            {state === "on" ? "turn off" : "turn on"}
          </RowButton>
        )}
      </div>
      <p className="NotificationsSection__hint">
        {state === "blocked"
          ? "Allow notifications for moneylogs in your phone's settings, then turn them on here."
          : "Pops up on this phone the moment something reaches your inbox. The types below choose what does."}
      </p>
      {state === "on" && (
        <>
          <label className="NotificationsSection__digest">
            <input
              type="checkbox"
              checked={reminderOn}
              onChange={(e) => void setReminder(e.target.checked)}
            />
            <span>evening reminder</span>
          </label>
          <p className="NotificationsSection__hint">
            If you haven&apos;t opened moneylogs by 8pm, a nudge to add what you spent or mark the
            day as no-spend. Push only, never emailed.
          </p>
        </>
      )}
    </section>
  );
};

export default PushSection;
