import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/config/firebase-config";
import { useGetMyLedgers } from "./useGetMyLedgers";
import { reportError } from "@/utils/reportError";

/**
 * Whether the signed-in user logged an entry dated `day` in one of their other financial
 * logs, and in which (its title). A no-spend day is the person's, not the log's: the
 * server refuses one if any of their logs has an entry by them that day, so a log with
 * nothing in it today shouldn't offer "nothing spent today" when another log does.
 *
 * A one-time read per other log, filtered on `date` only (the automatic single-field
 * index) with other members' entries dropped here, like useMyEntriesOnDay. Entries added
 * elsewhere after it loads are still caught by the server, which names the log.
 */
export const useLoggedOnDayElsewhere = ({
  ledgerId,
  day,
  enabled = true,
}: {
  ledgerId: string;
  /** YYYY-MM-DD */
  day: string;
  enabled?: boolean;
}): { elsewhere: string | null; isLoading: boolean } => {
  const [firebaseUser] = useAuthState(auth);
  const uid = enabled ? firebaseUser?.uid : undefined;
  const { ledgers, isLoading: ledgersLoading } = useGetMyLedgers({ enabled: !!uid });
  const others = useMemo(
    () => (ledgers ?? []).filter((l) => l.id !== ledgerId && !l.deleting),
    [ledgers, ledgerId],
  );
  const request = `${uid}|${day}|${others.map((l) => l.id).join(",")}`;
  const [result, setResult] = useState<{ request: string; elsewhere: string | null } | null>(null);

  useEffect(() => {
    if (!uid || ledgersLoading) return;
    let cancelled = false;
    const forRequest = request;
    const finish = (elsewhere: string | null) => {
      if (!cancelled) setResult({ request: forRequest, elsewhere });
    };
    Promise.all(
      others.map(async (ledger) => {
        const snap = await getDocs(
          query(collection(db, "ledgers", ledger.id, "entries"), where("date", "==", day)),
        );
        return snap.docs.some((d) => d.get("authorUid") === uid) ? ledger.title : null;
      }),
    )
      .then((titles) => finish(titles.find((t) => t !== null) ?? null))
      .catch((err) => {
        // The server still checks every log; this only decides whether to offer the button.
        reportError(err, { feature: "no_spend_day", action: "check_other_logs", level: "warning" });
        finish(null);
      });
    return () => {
      cancelled = true;
    };
    // `request` covers uid, day and which logs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, ledgersLoading]);

  const current = result?.request === request;
  return {
    elsewhere: current ? result.elsewhere : null,
    isLoading: !!uid && !current,
  };
};
