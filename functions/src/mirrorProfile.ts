import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { publicProfile, sameProfile } from "./profiles";

/**
 * Keep `profiles/{id}` in step with `users/{id}`. User docs are written often (view
 * tracking, read markers), so this compares the before/after projections and only
 * writes when a public field actually changed: no extra reads on the hot path.
 */
export const mirrorProfile = onDocumentWritten("users/{userDocId}", async (event) => {
  const { userDocId } = event.params;
  const ref = getFirestore().collection("profiles").doc(userDocId);
  const after = event.data?.after;

  if (!after?.exists) {
    await ref.delete();
    return;
  }

  const next = publicProfile(after.data());
  const before = event.data?.before;
  if (before?.exists && sameProfile(publicProfile(before.data()), next)) return;

  await ref.set({ ...next, updatedAt: FieldValue.serverTimestamp() });
});
