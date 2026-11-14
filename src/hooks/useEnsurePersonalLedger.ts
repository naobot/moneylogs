import { useEffect, useRef } from "react";

import { useCurrentUser } from "@/contexts";
import { ensurePersonalLedger } from "@/hooks/useLedgerQuery";
import { hasPersonalLedger, preferredCurrency } from "@/utils/personalLedger";
import { reportError } from "@/utils/reportError";

/**
 * Gives a signed-in user their solo "personal" financial log the first time they're seen
 * without one — new registrations and existing accounts alike. Runs at most once per user
 * per tab; the transaction itself is idempotent, so other tabs racing it are harmless.
 */
export const useEnsurePersonalLedger = () => {
  const { user } = useCurrentUser();
  const attempted = useRef<Set<string>>(new Set());

  const uid = user?.userId;
  const userDocId = user?.id;
  // New accounts get theirs from the welcome wizard, in the currency they pick there.
  const needsOne = !!user && !user.onboardingPending && !hasPersonalLedger(user);
  const defaultCurrency = user?.defaultCurrency;

  useEffect(() => {
    if (!needsOne || !uid || !userDocId || attempted.current.has(uid)) return;
    attempted.current.add(uid);
    ensurePersonalLedger({
      member: { uid, userDocId },
      defaultCurrency: preferredCurrency({ defaultCurrency }),
    }).catch((err: unknown) =>
      reportError(err, { feature: "personal_ledger", action: "ensure_personal_ledger" }),
    );
  }, [needsOne, uid, userDocId, defaultCurrency]);
};

export default useEnsurePersonalLedger;
