import { useEffect } from "react";
import { collection, documentId, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { LedgerMonth } from "@/types/ledger";
import { useFirebaseCollection } from "./useFirebase";

/**
 * Live monthly summaries (written by the recomputeLedgerMonth function) for an inclusive
 * range of "YYYY-MM" keys. Month doc ids sort chronologically, so one range query on the
 * document id covers the range with the automatic index.
 */
export const useLedgerMonths = ({
  ledgerId,
  from,
  to,
}: {
  ledgerId?: string;
  from: string;
  to: string;
}) => {
  const result = useFirebaseCollection<LedgerMonth>({
    queryBuilder: () =>
      ledgerId
        ? query(
            collection(db, "ledgers", ledgerId, "months"),
            where(documentId(), ">=", from),
            where(documentId(), "<=", to),
          )
        : null,
    dataTransformer: (docs) => docs.map((d) => ({ month: d.id, ...d.data() }) as LedgerMonth),
    dependencies: [ledgerId, from, to],
    enabled: !!ledgerId,
  });

  useEffect(() => {
    if (result.isError) console.error("Failed to load monthly summaries:", result.error);
  }, [result.isError, result.error]);

  const byMonth: Record<string, LedgerMonth> = {};
  for (const m of result.data) byMonth[m.month] = m;

  return { ...result, byMonth };
};
