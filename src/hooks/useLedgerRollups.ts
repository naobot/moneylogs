import { useEffect } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { Ledger, LedgerRollup } from "@/types/ledger";
import { hasRollups } from "@/utils/sublogs";
import { useFirebaseCollection } from "./useFirebase";
import { reportError } from "@/utils/reportError";

const NONE: LedgerRollup[] = [];

/**
 * Live sublog roll-ups for one month of a parent ledger (rollups/, written by the
 * functions in sublogs.ts). Only logs that have, or had, sublogs run the query; for any
 * other log this returns an empty list straight away.
 */
export const useLedgerRollups = ({ ledger, month }: { ledger: Ledger; month: string }) => {
  const enabled = hasRollups(ledger.categories ?? []);
  const result = useFirebaseCollection<LedgerRollup>({
    queryBuilder: () =>
      enabled
        ? query(collection(db, "ledgers", ledger.id, "rollups"), where("month", "==", month))
        : null,
    dataTransformer: (docs) => docs.map((d) => d.data() as LedgerRollup),
    dependencies: [ledger.id, month, enabled],
    enabled,
  });

  useEffect(() => {
    if (result.isError) reportError(result.error, { feature: "ledger", action: "load_rollups" });
  }, [result.isError, result.error]);

  const isLoading = enabled && (result.isLoading || (!result.isSuccess && !result.isError));
  return { rollups: enabled ? result.data : NONE, isLoading, isError: result.isError };
};
