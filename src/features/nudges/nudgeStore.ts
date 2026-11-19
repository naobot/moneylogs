import {
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/config/firebase-config";

import { MAX_POKES_PER_WRITE, Nudge, NUDGE_TTL_DAYS, nudgeId } from "./nudges";

export type NudgeParties = { from: string; fromUid: string; to: string; toUid: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Add pokes and/or a cheer to the one doc from you to a friend. A blind merge-write:
 * you can't read what's already waiting (only the recipient can), and don't need to.
 */
export const sendNudge = async (
  parties: NudgeParties,
  { pokes = 0, cheer }: { pokes?: number; cheer?: string },
): Promise<void> => {
  const count = Math.max(0, Math.min(MAX_POKES_PER_WRITE, Math.floor(pokes)));
  if (!count && !cheer) return;
  await setDoc(
    doc(db, "nudges", nudgeId(parties.from, parties.to)),
    {
      ...parties,
      pokes: increment(count),
      ...(cheer !== undefined && { cheer }),
      at: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + NUDGE_TTL_DAYS * DAY_MS),
    },
    { merge: true },
  );
};

/**
 * You've read it: delete it, unless more arrived since it was shown (then it stays, and
 * shows again with the new count).
 */
export const dismissNudge = (nudge: Pick<Nudge, "id" | "at">): Promise<void> =>
  runTransaction(db, async (tx) => {
    const ref = doc(db, "nudges", nudge.id);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const at = snap.get("at") as Timestamp | null;
    const shown = nudge.at;
    if (at && shown && !at.isEqual(shown)) return;
    tx.delete(ref);
  });
