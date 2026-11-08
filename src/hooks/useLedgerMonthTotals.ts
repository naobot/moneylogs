import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { CurrencyAmounts } from "@/types/ledger";

/**
 * One month's totals for several ledgers, from their derived month summaries: one small
 * document read per ledger instead of loading every entry. Missing summary = nothing spent.
 */
export const useLedgerMonthTotals = (ledgerIds: ReadonlyArray<string>, month: string) => {
  const [totals, setTotals] = useState<Record<string, CurrencyAmounts | null>>({});
  const key = ledgerIds.join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void Promise.all(
      key.split(",").map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "ledgers", id, "months", month));
          return [
            id,
            snap.exists() ? ((snap.data().totals as CurrencyAmounts) ?? {}) : {},
          ] as const;
        } catch (err) {
          // A ledger that was just deleted can still be in the list for a moment; its
          // summaries are then unreadable (rules look up the ledger). Not an error.
          if ((err as { code?: string })?.code !== "permission-denied") {
            console.error(`Failed to load ${month} totals for ledger ${id}:`, err);
          }
          return [id, null] as const;
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setTotals(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [key, month]);

  return totals;
};
