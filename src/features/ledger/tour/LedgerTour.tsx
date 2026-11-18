import { createContext, PropsWithChildren, ReactNode, useContext, useRef, useState } from "react";

import { useCurrentUser } from "@/contexts";
import { recordLedgerTour } from "@/hooks/useUserQuery";
import TutorialTooltip from "@/components/TutorialTooltip";
import { reportError, trackStep } from "@/utils/reportError";

import { personalLedgerId } from "@/utils/personalLedger";
import type { Ledger } from "@/types/ledger";

import { ledgerTourSteps, LedgerTourTarget, shouldShowLedgerTour } from "./tourRules";
import { track } from "@/utils/analytics";

type LedgerTourValue = {
  /** The target the current tip points at, or null when no tour is running. */
  activeTarget: LedgerTourTarget | null;
  /**
   * The tip bubble for a target, or null if it isn't that target's turn. `pointAt` is a
   * selector for the control to aim at when the tip sits in a wider wrapper.
   */
  tip: (target: LedgerTourTarget, pointAt?: string) => ReactNode;
  /** End the tour for good (finished, skipped, or the first entry was saved). */
  complete: () => void;
};

const INACTIVE: LedgerTourValue = { activeTarget: null, tip: () => null, complete: () => {} };

const LedgerTourContext = createContext<LedgerTourValue>(INACTIVE);

/** Tour state for whoever renders tips; inert outside a running tour. */
export const useLedgerTour = () => useContext(LedgerTourContext);

/**
 * Walks someone through a financial log, one tooltip at a time: their personal log, and
 * every log made since the tour went per-log (see tourRules.ts). Finishing, skipping or
 * saving an entry records it for that log on the user doc, so it shows once per log,
 * across devices.
 */
export const LedgerTourProvider = ({
  ledger,
  enabled,
  children,
}: PropsWithChildren<{ ledger: Pick<Ledger, "id" | "createdAt">; enabled: boolean }>) => {
  const { user } = useCurrentUser();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const recorded = useRef(false);

  const running = enabled && !done && shouldShowLedgerTour({ user, ledger });
  const steps = ledgerTourSteps(!!user && ledger.id === personalLedgerId(user.userId));

  const complete = () => {
    setDone(true);
    if (recorded.current || !user || user.tutorials?.ledgerTours?.[ledger.id]) return;
    recorded.current = true;
    recordLedgerTour(user.id, ledger.id).catch((err: unknown) => {
      recorded.current = false;
      // Unnoticed by the user (the tour may just show again), so only a warning.
      reportError(err, { feature: "ledger_tour", action: "record_tour", level: "warning" });
    });
  };

  if (!running) {
    return (
      <LedgerTourContext.Provider value={{ ...INACTIVE, complete }}>
        {children}
      </LedgerTourContext.Provider>
    );
  }

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;
  const advance = () => {
    trackStep("ledger_tour", isLast ? "finished tour" : "next tour tip", {
      target: current.target,
    });
    if (isLast) {
      track("tutorial_complete", { tutorial: "ledger_tour" });
      complete();
    } else setStep((s) => s + 1);
  };
  const skip = () => {
    trackStep("ledger_tour", "skipped tour", { target: current.target });
    complete();
  };

  const value: LedgerTourValue = {
    activeTarget: current.target,
    complete,
    tip: (target, pointAt) =>
      target === current.target ? (
        <TutorialTooltip
          text={current.text}
          position={current.position ?? "bottom"}
          align={current.align}
          progress={`${step + 1}/${steps.length}`}
          hint={isLast ? "tap to finish" : "tap for next"}
          onDismiss={advance}
          onSkip={isLast ? undefined : skip}
          pointAt={pointAt}
        />
      ) : null,
  };

  return <LedgerTourContext.Provider value={value}>{children}</LedgerTourContext.Provider>;
};
