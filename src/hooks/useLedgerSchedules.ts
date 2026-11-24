import { useEffect } from "react";
import { collection } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { LedgerSchedule } from "@/types/ledger";
import { reportError } from "@/utils/reportError";
import { useFirebaseCollection } from "./useFirebase";

/**
 * A ledger's scheduled payments, live. A ledger has a handful at most, so it's the whole
 * subcollection (members can read every one), grouped by category where it's shown.
 */
export const useLedgerSchedules = (ledgerId?: string) => {
  const result = useFirebaseCollection<LedgerSchedule>({
    queryBuilder: () => (ledgerId ? collection(db, "ledgers", ledgerId, "schedules") : null),
    dataTransformer: (docs) =>
      docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          categoryId: data.categoryId,
          label: data.label,
          amount: data.amount,
          currency: data.currency,
          repeat: data.repeat,
          ownerUid: data.ownerUid,
          ownerDocId: data.ownerDocId,
          ...(data.paused ? { paused: true } : {}),
          ...(typeof data.nextDue === "string" ? { nextDue: data.nextDue } : {}),
          ...(typeof data.lastLogged === "string" ? { lastLogged: data.lastLogged } : {}),
        };
      }),
    dependencies: [ledgerId],
    enabled: !!ledgerId,
  });

  useEffect(() => {
    if (result.isError) reportError(result.error, { feature: "ledger", action: "load_schedules" });
  }, [result.isError, result.error]);

  return { schedules: result.data, isLoading: result.isLoading, isError: result.isError };
};
