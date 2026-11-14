import { useEffect, useRef } from "react";

import { useCurrentUser } from "@/contexts";
import { ensurePersonalLedger } from "@/hooks/useLedgerQuery";
import { hasPersonalLedger, preferredCurrency } from "@/utils/personalLedger";

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
  const needsOne = !!user && !hasPersonalLedger(user);
  const defaultCurrency = user?.defaultCurrency;

  useEffect(() => {
    if (!needsOne || !uid || !userDocId || attempted.current.has(uid)) return;
    attempted.current.add(uid);
    ensurePersonalLedger({
      member: { uid, userDocId },
      defaultCurrency: preferredCurrency({ defaultCurrency }),
    }).catch((err) => console.error("Failed to create personal log:", err));
  }, [needsOne, uid, userDocId, defaultCurrency]);
};

export default useEnsurePersonalLedger;
