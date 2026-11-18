import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";
import {
  acceptedFriendIds,
  FriendPairData,
  friendshipFlipped,
  hiddenFromFriendLists,
  pairUsers,
  sameIds,
  showsFriendList,
} from "./friendList";
import { withSentry } from "./sentry";

/**
 * Rebuild friendLists/{userDocId} from scratch (idempotent): delete it unless the owner
 * shows their friends, otherwise list their accepted friends minus anyone who opted out
 * of appearing on friends lists. Writes only when the list actually changes.
 */
export const syncFriendList = async (db: Firestore, userDocId: string) => {
  const listRef = db.collection("friendLists").doc(userDocId);
  const user = await db.collection("users").doc(userDocId).get();

  if (!user.exists || !showsFriendList(user.data())) {
    const current = await listRef.get();
    if (current.exists) await listRef.delete();
    return;
  }

  // array-contains alone (no composite index); the status filter happens in code.
  const [pairs, current] = await Promise.all([
    db.collection("friendships").where("users", "array-contains", userDocId).get(),
    listRef.get(),
  ]);
  const ids = acceptedFriendIds(
    pairs.docs.map((d) => d.data() as FriendPairData),
    userDocId,
  );
  const friendDocs = ids.length
    ? await db.getAll(...ids.map((id) => db.collection("users").doc(id)))
    : [];
  const shown = friendDocs
    .filter((d) => d.exists && !hiddenFromFriendLists(d.data()))
    .map((d) => d.id);

  const before = (current.get("friends") ?? []) as string[];
  if (current.exists && sameIds(before, shown)) return;
  await listRef.set({ friends: shown, updatedAt: FieldValue.serverTimestamp() });
};

/**
 * Someone's `hideFromFriendLists` flipped: every public list they're on (or should be on)
 * belongs to one of their friends, so rebuild those.
 */
export const syncFriendsOf = async (db: Firestore, userDocId: string) => {
  const pairs = await db
    .collection("friendships")
    .where("users", "array-contains", userDocId)
    .get();
  const friends = acceptedFriendIds(
    pairs.docs.map((d) => d.data() as FriendPairData),
    userDocId,
  );
  await Promise.all(friends.map((id) => syncFriendList(db, id)));
};

/** A friendship started or ended (accepting, unfriending, invites, account deletion). */
export const mirrorFriendList = onDocumentWritten(
  "friendships/{pairId}",
  withSentry("mirrorFriendList", async (event) => {
    const before = event.data?.before?.data() as FriendPairData | undefined;
    const after = event.data?.after?.data() as FriendPairData | undefined;
    if (!friendshipFlipped(before, after)) return;
    const db = getFirestore();
    await Promise.all(pairUsers(before, after).map((id) => syncFriendList(db, id)));
  }),
);
