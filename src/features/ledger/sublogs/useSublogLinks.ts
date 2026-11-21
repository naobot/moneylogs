import { useMemo } from "react";
import { useGetMyLedgers } from "@/hooks/useGetMyLedgers";
import { LedgerCategory } from "@/types/ledger";
import { activeSublogs } from "@/utils/sublogs";

/**
 * The parent's live linked categories, each with the sublog to open, or null when the
 * viewer isn't a member of it (a spouse not in "business" still sees the line, but it
 * can't lead anywhere they could open). Reuses the my-ledgers query the nav already runs,
 * and only when the log has sublogs, so other logs make no extra query.
 */
export const useSublogLinks = (
  categories: ReadonlyArray<LedgerCategory>,
): ReadonlyMap<string, string | null> => {
  const sublogs = useMemo(() => activeSublogs(categories), [categories]);
  const { ledgers } = useGetMyLedgers({ enabled: sublogs.size > 0 });
  return useMemo(() => {
    const mine = new Set(ledgers.map((l) => l.id));
    return new Map(
      [...sublogs].map(([categoryId, childId]) => [categoryId, mine.has(childId) ? childId : null]),
    );
  }, [sublogs, ledgers]);
};
