import type { BulkWriter, DocumentReference, Firestore } from "firebase-admin/firestore";

/**
 * Deletes a document and everything under it, the document itself last, and only once
 * everything under it is gone.
 *
 * `db.recursiveDelete(ref)` deletes the document even when deleting something under it
 * fails. The callers (deleteUserData, purgeLog) find what to delete by querying for the
 * top documents, so a retry would no longer find that document and would leave whatever
 * failed behind for good, then report success. Keeping the document until its
 * subcollections are empty means a failed run can always be finished by calling again.
 */
export const deleteTreeRootLast = async (
  db: Pick<Firestore, "recursiveDelete">,
  ref: Pick<DocumentReference, "listCollections" | "delete">,
  bulk?: BulkWriter,
): Promise<void> => {
  let firstError: unknown = null;
  // Each subcollection with everything beneath it. Keep going after a failure so a
  // retry has less left to do.
  for (const collection of await ref.listCollections()) {
    try {
      await db.recursiveDelete(collection, bulk);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
  await ref.delete();
};
