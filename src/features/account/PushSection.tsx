import { useEffect, useState } from "react";

import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useToastContext } from "@/hooks/useToastContext";
import { PushState, readPushState, turnPushOff, turnPushOn } from "@/features/push/devicePush";
import { reportError } from "@/utils/reportError";

import "./DisplaySection.scss";

const PUSH_LABELS: Record<PushState, string> = {
  on: "On",
  off: "Off",
  blocked: "Off in phone settings",
};

/**
 * Push notifications on this phone (native app only). Nothing is asked of the OS until
 * the person turns it on here. What gets pushed follows the same per-type preferences
 * as the inbox.
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

  return (
    <div className="PushSection">
      <div className="DisplaySection__row">
        <span className="DisplaySection__label">on this phone</span>
        <span>{state ? PUSH_LABELS[state] : "…"}</span>
        {state && state !== "blocked" && (
          <RowButton onClick={() => void toggle()} disabled={pending}>
            {state === "on" ? "turn off" : "turn on"}
          </RowButton>
        )}
      </div>
      <p className="DisplaySection__hint">
        {state === "blocked"
          ? "Allow notifications for moneylogs in your phone's settings, then turn them on here."
          : "Comments, reactions, log updates and budget alerts, as they arrive in your inbox."}
      </p>
    </div>
  );
};

export default PushSection;
