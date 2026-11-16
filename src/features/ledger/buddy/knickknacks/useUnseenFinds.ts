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
 * "special" ones are granted by hand. A missing `source` means found.
 */
export type KnickKnackFind = {
  id: string;
  item: KnickKnackId;
  /** The log whose buddy found it (or handed it over); null on gifts. */
  ledgerId: string | null;
  /** When it was first found (kept from the giver's find on gifts). */
  foundAt?: Timestamp | null;
  seenAt: Timestamp | null;
  source?: "found" | "gift" | "milestone" | "special";
  /** Gifts only: the giver's user doc id, and when it was given. */
  giftedBy?: string | null;
  giftedAt?: Timestamp | null;
};

const foundMs = (f: KnickKnackFind) => f.foundAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;

/**
 * The oldest find the user hasn't seen yet, live. Finds for items this build doesn't
 * know (a newer catalog on the server) wait until the app updates.
 */
export const useUnseenFind = (userDocId?: string): KnickKnackFind | null => {
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

  // Gifts are unwrapped in the drawer, not revealed by the buddy.
  const known = data.filter((f) => f.item in KNICK_KNACKS && f.source !== "gift");
  if (!known.length) return null;
  return known.reduce((oldest, f) => (foundMs(f) < foundMs(oldest) ? f : oldest));
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
