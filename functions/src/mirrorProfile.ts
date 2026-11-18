import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { publicProfile, sameProfile } from "./profiles";
import { hiddenFromFriendLists, showsFriendList } from "./friendList";
import { syncFriendList, syncFriendsOf } from "./mirrorFriendList";
import { withSentry } from "./sentry";

/**
 * Keep `profiles/{id}` in step with `users/{id}`. User docs are written often (view
 * tracking, read markers), so this compares the before/after projections and only
 * writes when a public field actually changed: no extra reads on the hot path.
 *
 * It also watches the two friends-list switches (see friendList.ts): flipping
 * `showFriends` rebuilds this person's friendLists doc, and flipping
 * `hideFromFriendLists` rebuilds their friends' lists.
 */
export const mirrorProfile = onDocumentWritten(
  "users/{userDocId}",
  withSentry("mirrorProfile", async (event) => {
    const { userDocId } = event.params;
    const db = getFirestore();
    const ref = db.collection("profiles").doc(userDocId);
    const after = event.data?.after;
    const before = event.data?.before;

    if (!after?.exists) {
      await Promise.all([ref.delete(), db.collection("friendLists").doc(userDocId).delete()]);
      return;
    }

    const beforeData = before?.exists ? before.data() : undefined;
    const afterData = after.data();
    const writes: Promise<void>[] = [];
    if (showsFriendList(beforeData) !== showsFriendList(afterData)) {
      writes.push(syncFriendList(db, userDocId));
    }
    if (hiddenFromFriendLists(beforeData) !== hiddenFromFriendLists(afterData)) {
      writes.push(syncFriendsOf(db, userDocId));
    }

    const next = publicProfile(afterData);
    if (!(before?.exists && sameProfile(publicProfile(beforeData), next))) {
      writes.push(ref.set({ ...next, updatedAt: FieldValue.serverTimestamp() }).then(() => {}));
    }
    await Promise.all(writes);
  }),
);
