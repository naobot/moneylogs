import { useEffect, useMemo } from "react";
import { collection, query, where } from "firebase/firestore";

import { db } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { useFirebaseCollection } from "@/hooks/useFirebase";
import { reportError } from "@/utils/reportError";

import type { Nudge } from "./nudges";

/**
 * Pokes and cheers waiting for you, live, by who sent them. One equality query on your
 * auth uid (what the read rule allows); no composite index.
 */
export const useNudges = (): ReadonlyMap<string, Nudge> => {
  const { user } = useCurrentUser();
  const uid = user?.userId;

  const result = useFirebaseCollection<Nudge>({
    queryBuilder: () => (uid ? query(collection(db, "nudges"), where("toUid", "==", uid)) : null),
    dataTransformer: (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as Nudge),
    dependencies: [uid],
    enabled: !!uid,
  });

  useEffect(() => {
    if (result.isError)
      reportError(result.error, { feature: "friends", action: "load_nudges", level: "warning" });
  }, [result.isError, result.error]);

  return useMemo(
    () => new Map(result.data.filter((n) => n.pokes > 0 || n.cheer).map((n) => [n.from, n])),
    [result.data],
  );
};
