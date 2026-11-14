import { createContext, PropsWithChildren, ReactNode, useContext, useRef, useState } from "react";
import { serverTimestamp } from "firebase/firestore";

import { useCurrentUser } from "@/contexts";
import { useLedgerHasEntries } from "@/hooks/useLedgerHasEntries";
import { updateUserFields } from "@/hooks/useUserQuery";
import TutorialTooltip from "@/components/TutorialTooltip";

import { LEDGER_TOUR_STEPS, LedgerTourTarget, shouldShowLedgerTour } from "./tourRules";

type LedgerTourValue = {
  /** The target the current tip points at, or null when no tour is running. */
  activeTarget: LedgerTourTarget | null;
  /** The tip bubble for a target, or null if it isn't that target's turn. */
  tip: (target: LedgerTourTarget) => ReactNode;
  /** End the tour for good (finished, skipped, or the first entry was saved). */
  complete: () => void;
};

const INACTIVE: LedgerTourValue = { activeTarget: null, tip: () => null, complete: () => {} };

const LedgerTourContext = createContext<LedgerTourValue>(INACTIVE);

/** Tour state for whoever renders tips; inert outside a running tour. */
export const useLedgerTour = () => useContext(LedgerTourContext);

/**
 * Walks a first-timer through their empty personal log, one tooltip at a time (see
 * ledgerTour.ts for when it runs). Finishing, skipping or saving a first entry records it
 * on the user doc, so it shows once across devices.
 */
export const LedgerTourProvider = ({
  ledgerId,
  enabled,
  children,
}: PropsWithChildren<{ ledgerId: string; enabled: boolean }>) => {
  const { user } = useCurrentUser();
  // Everything but emptiness can be decided from the profile; only then spend a read on it.
  const candidate = enabled && shouldShowLedgerTour({ user, ledgerId, hasEntries: false });
  const hasEntries = useLedgerHasEntries(ledgerId, candidate);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const recorded = useRef(false);

  const running = candidate && !done && shouldShowLedgerTour({ user, ledgerId, hasEntries });

  const complete = () => {
    setDone(true);
    if (recorded.current || !user || user.tutorials?.ledgerTour) return;
    recorded.current = true;
    updateUserFields(user.id, { "tutorials.ledgerTour": serverTimestamp() }).catch(
      (err: unknown) => {
        recorded.current = false;
        console.error("Failed to record the ledger tour:", err);
      },
    );
  };

  if (!running) {
    return (
      <LedgerTourContext.Provider value={{ ...INACTIVE, complete }}>
        {children}
      </LedgerTourContext.Provider>
    );
  }

  const current = LEDGER_TOUR_STEPS[Math.min(step, LEDGER_TOUR_STEPS.length - 1)];
  const isLast = step >= LEDGER_TOUR_STEPS.length - 1;
  const advance = () => (isLast ? complete() : setStep((s) => s + 1));

  const value: LedgerTourValue = {
    activeTarget: current.target,
    complete,
    tip: (target) =>
      target === current.target ? (
        <TutorialTooltip
          text={current.text}
          position={current.position ?? "bottom"}
          align={current.align}
          progress={`${step + 1}/${LEDGER_TOUR_STEPS.length}`}
          hint={isLast ? "tap to finish" : "tap for next"}
          onDismiss={advance}
          onSkip={isLast ? undefined : complete}
        />
      ) : null,
  };

  return <LedgerTourContext.Provider value={value}>{children}</LedgerTourContext.Provider>;
};
