import { useEffect, useMemo, useState } from "react";
import { collection, doc, getCountFromServer, query, Timestamp, where } from "firebase/firestore";

import { db } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import type { Group } from "@/types/user";
import { ActivityTarget, logsToCount } from "@/utils/logActivity";

/** New posts/entries by other people per log id. A log missing from the map shows no badge. */
export type LogActivity = Record<string, number>;

const countQueryFor = (target: ActivityTarget, me: { docId: string; uid: string }) => {
  const since = Timestamp.fromMillis(target.sinceMs);
  if (target.kind === "social") {
    return query(
      collection(db, "log_posts"),
      where("group", "==", doc(db, "log_groups", target.id)),
      where("author", "!=", doc(db, "users", me.docId)),
      where("createdAt", ">", since),
    );
  }
  return query(
    collection(db, "ledgers", target.id, "entries"),
    where("authorUid", "!=", me.uid),
    where("createdAt", ">", since),
  );
};

/**
 * How much other people have added to each of the user's current logs since they last
 * opened it. One aggregation query per log (about one read each), fetched once per
 * mount: Home is re-mounted on every return, which is when the numbers can change.
 *
 * Failures (missing index on a preview channel, offline, a just-deleted ledger) drop that
 * log from the result instead of failing the page.
 */
export const useLogActivity = ({
  groups,
  ledgers,
}: {
  groups: ReadonlyArray<Group>;
  ledgers: ReadonlyArray<{ id: string }>;
}): { activity: LogActivity; isLoading: boolean } => {
  const { user } = useCurrentUser();
  const docId = user?.id;
  const uid = user?.userId;

  const targets = useMemo(() => logsToCount({ groups, ledgers, user }), [groups, ledgers, user]);
  // Only refetch when the set of logs or their markers actually change, not on every
  // user-doc or groups snapshot.
  const key = targets.map((t) => `${t.kind}:${t.id}:${t.sinceMs}`).join("|");

  const [state, setState] = useState<{ key: string; activity: LogActivity } | null>(null);

  useEffect(() => {
    if (!docId || !uid || !key) return;
    let cancelled = false;
    const me = { docId, uid };
    const pending = key.split("|").map((part) => {
      const [kind, id, sinceMs] = part.split(":");
      return { kind, id, sinceMs: Number(sinceMs) } as ActivityTarget;
    });

    void Promise.all(
      pending.map(async (target) => {
        try {
          const snap = await getCountFromServer(countQueryFor(target, me));
          return [target.id, snap.data().count] as const;
        } catch (err) {
          // permission-denied: a ledger deleted moments ago. Anything else (most often a
          // missing composite index outside production) is worth a console note.
          if ((err as { code?: string })?.code !== "permission-denied") {
            console.warn(`Couldn't count new activity for ${target.id}:`, err);
          }
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const activity: LogActivity = {};
      for (const result of results) if (result) activity[result[0]] = result[1];
      setState({ key, activity });
    });

    return () => {
      cancelled = true;
    };
  }, [key, docId, uid]);

  if (!key) return { activity: {}, isLoading: false };
  return {
    activity: state?.key === key ? state.activity : {},
    isLoading: state?.key !== key,
  };
};

export default useLogActivity;
