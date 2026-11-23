import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { Ledger, LedgerEntry } from "@/types/ledger";
import { sortEntries } from "@/utils/ledgerEntries";
import { PullGroup, toPullGroup } from "@/utils/pullLines";
import { reportError } from "@/utils/reportError";

/**
 * The signed-in user's own entries on one day, across their financial logs, for pulling
 * into a social post. Ledgers with nothing that day are left out.
 *
 * A one-time read per ledger (the picker is a snapshot, not a live view), filtered on
 * `date` only, the automatic single-field index. Other members' entries are dropped
 * client-side, which avoids a composite index that preview channels wouldn't have.
 */
export const useMyEntriesOnDay = ({
  ledgers,
  uid,
  day,
  enabled,
}: {
  /** Pass a stable array: each new one refetches. */
  ledgers: ReadonlyArray<Ledger> | undefined;
  uid: string | undefined;
  /** YYYY-MM-DD */
  day: string;
  enabled: boolean;
}) => {
  // The last finished load, tagged with what it was for; loading is "the latest
  // request hasn't finished yet", so no state is set when a request starts.
  const [result, setResult] = useState<{
    request: string;
    ledgers: ReadonlyArray<Ledger>;
    groups: PullGroup[];
    isError: boolean;
  } | null>(null);
  const request = `${uid}|${day}`;

  useEffect(() => {
    if (!enabled || !uid || !ledgers) return;
    let cancelled = false;
    const finish = (groups: PullGroup[], isError: boolean) => {
      if (!cancelled) setResult({ request: `${uid}|${day}`, ledgers, groups, isError });
    };

    const live = ledgers.filter((l) => !l.deleting);
    Promise.all(
      live.map(async (ledger) => {
        const snap = await getDocs(
          query(collection(db, "ledgers", ledger.id, "entries"), where("date", "==", day)),
        );
        const mine = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry)
          .filter((e) => e.authorUid === uid);
        return toPullGroup(ledger, sortEntries(mine).reverse());
      }),
    )
      .then((all) =>
        finish(
          all.filter((g) => g.entries.length > 0),
          false,
        ),
      )
      .catch((err) => {
        reportError(err, { feature: "log_post", action: "load_ledger_entries_for_post" });
        finish([], true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, uid, day, ledgers]);

  const current = result && result.request === request && result.ledgers === ledgers;
  return {
    groups: current ? result.groups : EMPTY,
    isLoading: enabled && !!uid && !!ledgers && !current,
    isError: current ? result.isError : false,
  };
};

const EMPTY: PullGroup[] = [];
