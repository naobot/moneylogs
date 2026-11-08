import { useEffect } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { LedgerEntry } from "@/types/ledger";
import { sortEntries } from "@/utils/ledgerEntries";
import { useFirebaseCollection } from "./useFirebase";

/**
 * Live entries for one month of a ledger, newest first.
 *
 * Filters on `month` only (automatic single-field index) and sorts client-side: a month
 * holds at most a few hundred entries, and this avoids a composite index that preview
 * channels (hosting-only deploys) wouldn't have.
 */
export const useGetLedgerEntries = ({ ledgerId, month }: { ledgerId?: string; month: string }) => {
  const result = useFirebaseCollection<LedgerEntry>({
    queryBuilder: () =>
      ledgerId
        ? query(collection(db, "ledgers", ledgerId, "entries"), where("month", "==", month))
        : null,
    dataTransformer: (docs) =>
      sortEntries(docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry)),
    dependencies: [ledgerId, month],
    enabled: !!ledgerId,
  });

  useEffect(() => {
    if (result.isError) console.error("Failed to load entries:", result.error);
  }, [result.isError, result.error]);

  // Report loading until the first snapshot for this month arrives.
  const isLoading = result.isLoading || (!!ledgerId && !result.isSuccess && !result.isError);

  return { ...result, entries: result.data, isLoading };
};
