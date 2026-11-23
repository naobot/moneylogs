import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { Ledger, LedgerEntry } from "@/types/ledger";
import { sortEntries } from "@/utils/ledgerEntries";
import { PullGroup, pulledIdsIn, toPullGroup } from "@/utils/pullLines";
import { chunk } from "@/utils/chunk";
import { reportError } from "@/utils/reportError";

/**
 * The signed-in user's own entries on one day, across their financial logs, for pulling
 * into a social post. Ledgers with nothing that day are left out.
 *
 * A one-time read per ledger (the picker is a snapshot, not a live view), filtered on
 * `date` only, the automatic single-field index. Other members' entries are dropped
 * client-side, which avoids a composite index that preview channels wouldn't have.
 *
 * Also finds which of those entries are already in one of the author's posts in this
 * social log, including older posts the page hasn't loaded: one `array-contains-any`
 * read per 30 pull keys (single-field index), narrowed to the log and author
 * client-side. Only the author's own entries' keys are asked for, so only their posts match.
 */
export const useMyEntriesOnDay = ({
  ledgers,
  uid,
  day,
  groupId,
  authorDocId,
  enabled,
}: {
  /** Pass a stable array: each new one refetches. */
  ledgers: ReadonlyArray<Ledger> | undefined;
  uid: string | undefined;
  /** YYYY-MM-DD */
  day: string;
  /** The social log the post is in. */
  groupId: string;
  /** The author's users-collection doc id (what posts' `author` references). */
  authorDocId: string | undefined;
  enabled: boolean;
}) => {
  // The last finished load, tagged with what it was for; loading is "the latest
  // request hasn't finished yet", so no state is set when a request starts.
  const [result, setResult] = useState<{
    request: string;
    ledgers: ReadonlyArray<Ledger>;
    groups: PullGroup[];
    pulled: ReadonlySet<string>;
    isError: boolean;
  } | null>(null);
  const request = `${uid}|${day}|${groupId}|${authorDocId}`;

  useEffect(() => {
    if (!enabled || !uid || !ledgers || !authorDocId) return;
    let cancelled = false;
    const forRequest = `${uid}|${day}|${groupId}|${authorDocId}`;
    const finish = (groups: PullGroup[], pulled: ReadonlySet<string>, isError: boolean) => {
      if (!cancelled) setResult({ request: forRequest, ledgers, groups, pulled, isError });
    };

    const load = async () => {
      const all = await Promise.all(
        ledgers
          .filter((l) => !l.deleting)
          .map(async (ledger) => {
            const snap = await getDocs(
              query(collection(db, "ledgers", ledger.id, "entries"), where("date", "==", day)),
            );
            const mine = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry)
              .filter((e) => e.authorUid === uid);
            return toPullGroup(ledger, sortEntries(mine).reverse());
          }),
      );
      const groups = all.filter((g) => g.entries.length > 0);
      const ids = groups.flatMap((g) => g.entries.map((e) => e.id));
      const pulled = ids.length > 0 ? await pulledInLog(ids, groupId, authorDocId) : EMPTY_IDS;
      finish(groups, pulled, false);
    };

    load().catch((err) => {
      reportError(err, { feature: "log_post", action: "load_ledger_entries_for_post" });
      finish(EMPTY, EMPTY_IDS, true);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, uid, day, groupId, authorDocId, ledgers]);

  const current = result && result.request === request && result.ledgers === ledgers;
  return {
    groups: current ? result.groups : EMPTY,
    /** Pull keys already in one of the author's posts in this log, loaded or not. */
    pulled: current ? result.pulled : EMPTY_IDS,
    isLoading: enabled && !!uid && !!ledgers && !!authorDocId && !current,
    isError: current ? result.isError : false,
  };
};

// Firestore's cap on array-contains-any values.
const IDS_PER_QUERY = 30;

const pulledInLog = async (
  entryIds: string[],
  groupId: string,
  authorDocId: string,
): Promise<Set<string>> => {
  const snaps = await Promise.all(
    chunk(entryIds, IDS_PER_QUERY).map((ids) =>
      getDocs(
        query(collection(db, "log_posts"), where("pulledEntryIds", "array-contains-any", ids)),
      ),
    ),
  );
  const posts = snaps
    .flatMap((snap) => snap.docs.map((d) => d.data()))
    .filter((p) => p.group?.id === groupId)
    .map((p) => ({ author: p.author, pulledEntryIds: p.pulledEntryIds as string[] | undefined }));
  return pulledIdsIn(posts, authorDocId);
};

const EMPTY: PullGroup[] = [];
const EMPTY_IDS: ReadonlySet<string> = new Set();
