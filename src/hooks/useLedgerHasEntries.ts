import { useEffect, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { reportError } from "@/utils/reportError";

/**
 * Whether a ledger has any entries at all, read once with a single-doc query. Undefined
 * until known (or when disabled, or if the read fails), so callers can stay quiet.
 */
export const useLedgerHasEntries = (ledgerId: string | undefined, enabled = true) => {
  const [result, setResult] = useState<{ id: string; hasEntries: boolean }>();

  useEffect(() => {
    if (!ledgerId || !enabled) return;
    let cancelled = false;
    getDocs(query(collection(db, "ledgers", ledgerId, "entries"), limit(1)))
      .then((snap) => {
        if (!cancelled) setResult({ id: ledgerId, hasEntries: !snap.empty });
      })
      .catch((err: unknown) =>
        // Only decides whether to offer the tour, so a failure just means no tour.
        reportError(err, {
          feature: "ledger_tour",
          action: "check_ledger_has_entries",
          level: "warning",
        }),
      );
    return () => {
      cancelled = true;
    };
  }, [ledgerId, enabled]);

  return result && result.id === ledgerId ? result.hasEntries : undefined;
};

export default useLedgerHasEntries;
