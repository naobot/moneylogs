import { useEffect } from "react";
import {
  collection,
  doc,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase-config";
import { useFirebaseCollection } from "@/hooks/useFirebase";
import { KNICK_KNACKS, KnickKnackId } from "./catalog";
import { reportError } from "@/utils/reportError";

/**
 * users/{userDocId}/knickknacks/{findId}: written by the server when the buddy finds
 * one, when a friend gifts one, or when the buddy hands over a coin (a milestone).
 * "special" and "granted" ones are added by hand (admin panel). A missing `source` means
 * found.
 */
export type KnickKnackFind = {
  id: string;
  item: KnickKnackId;
  /** The log whose buddy found it (or handed it over); null on gifts. */
  ledgerId: string | null;
  /** When it was first found (kept from the giver's find on gifts). */
  foundAt?: Timestamp | null;
  seenAt: Timestamp | null;
  source?: "found" | "gift" | "milestone" | "special" | "granted";
  /** Gifts only: the giver's user doc id, and when it was given. */
  giftedBy?: string | null;
  giftedAt?: Timestamp | null;
};

const foundMs = (f: KnickKnackFind) => f.foundAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;

/**
 * Whether a buddy can reveal this find: one that came from something done in a financial
 * log (catalog `fromLog`), not a gift. Everything else is revealed from the drawer.
 */
export const isLogFind = (find: Pick<KnickKnackFind, "item" | "source">): boolean =>
  find.source !== "gift" && !!KNICK_KNACKS[find.item]?.fromLog;

/**
 * The oldest find this log's buddy can show the user, live: unseen, from this log, and
 * from something done in a log. Finds for items this build doesn't know (a newer catalog
 * on the server) wait until the app updates.
 */
export const useUnseenFind = (userDocId?: string, ledgerId?: string): KnickKnackFind | null => {
  const { data, isError, error } = useFirebaseCollection<KnickKnackFind>({
    queryBuilder: () =>
      userDocId
        ? query(collection(db, "users", userDocId, "knickknacks"), where("seenAt", "==", null))
        : null,
    dataTransformer: (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as KnickKnackFind),
    dependencies: [userDocId],
    enabled: !!userDocId,
  });

  useEffect(() => {
    if (isError) reportError(error, { feature: "budget_buddy", action: "load_unseen_finds" });
  }, [isError, error]);

  const mine = data.filter(
    (f) => f.item in KNICK_KNACKS && f.ledgerId === ledgerId && isLogFind(f),
  );
  if (!mine.length) return null;
  return mine.reduce((oldest, f) => (foundMs(f) < foundMs(oldest) ? f : oldest));
};

/** Every find the user has, seen or not, live: the knick-knack drawer's contents. */
export const useKnickKnackFinds = (userDocId?: string) => {
  const result = useFirebaseCollection<KnickKnackFind>({
    queryBuilder: () => (userDocId ? collection(db, "users", userDocId, "knickknacks") : null),
    dataTransformer: (docs) => docs.map((d) => ({ id: d.id, ...d.data() }) as KnickKnackFind),
    dependencies: [userDocId],
    enabled: !!userDocId,
  });

  useEffect(() => {
    if (result.isError) {
      reportError(result.error, { feature: "budget_buddy", action: "load_knickknack_drawer" });
    }
  }, [result.isError, result.error]);

  return result;
};

/** The owner may set seenAt once (firestore.rules). */
export const markFindSeen = (userDocId: string, findId: string) =>
  updateDoc(doc(db, "users", userDocId, "knickknacks", findId), { seenAt: serverTimestamp() });
