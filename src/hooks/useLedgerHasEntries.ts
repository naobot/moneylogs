import { useEffect, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/config/firebase-config";

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
      .catch((err: unknown) => console.error("Failed to check ledger entries:", err));
    return () => {
      cancelled = true;
    };
  }, [ledgerId, enabled]);

  return result && result.id === ledgerId ? result.hasEntries : undefined;
};

export default useLedgerHasEntries;
