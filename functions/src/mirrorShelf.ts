import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { sameShelf, ShelfFind, ShelfItem, shelfOf } from "./shelf";

/**
 * Keep shelves/{userDocId} in step with users/{id}/knickknacks: a find kept (seen),
 * gifted away or received changes what the shelf shows. Recomputed from all of the
 * person's finds, so it's idempotent. Only writes when the shelf actually changes, so
 * a second copy of something you already have never touches it.
 */
export const mirrorShelf = onDocumentWritten(
  "users/{userDocId}/knickknacks/{findId}",
  async (event) => {
    const { userDocId } = event.params;
    const db = getFirestore();
    const userRef = db.collection("users").doc(userDocId);
    const shelfRef = db.collection("shelves").doc(userDocId);

    const [user, finds, shelf] = await Promise.all([
      userRef.get(),
      userRef.collection("knickknacks").where("seenAt", "!=", null).get(),
      shelfRef.get(),
    ]);
    // Account deletion removes finds one by one: don't leave a shelf behind.
    if (!user.exists) {
      await shelfRef.delete();
      return;
    }

    const items = shelfOf(finds.docs.map((d) => d.data() as ShelfFind));
    const current = (shelf.get("items") ?? []) as ShelfItem[];
    if (shelf.exists && sameShelf(current, items)) return;
    await shelfRef.set({ items, updatedAt: FieldValue.serverTimestamp() });
  },
);
