import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import {
  DocumentReference,
  FieldPath,
  FieldValue,
  Firestore,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { alertBudgetsIfCurrent, recomputeMonth } from "./ledgerMonths";
import {
  addLinkedCategory,
  isActiveSublog,
  LINK_ERROR_MESSAGES,
  LinkableCategory,
  LinkableLedger,
  linkedCategoryName,
  markCategoryUnlinked,
  ParentLink,
  parseLinkRequest,
  rollupDocId,
  rollupFor,
  validateLink,
} from "./ledgerRollup";
import { reportError, withSentry, withSentryCall } from "./sentry";

/**
 * Sublogs: a ledger whose spending also counts as one category of another ledger.
 * Pure rules live in ledgerRollup.ts; this file does the Firestore work.
 *
 * - ledgers/{child}.parentLink names the parent, its linked category and the first month
 *   that counts. Only these functions write it (firestore.rules).
 * - ledgers/{parent}/rollups/{YYYY-MM}__{child} holds that month of the child, counting
 *   only entries by parent members. Rebuilt from the child's entries, so it's idempotent.
 * - The parent's months/ docs merge in their roll-ups (ledgerMonths.recomputeMonth).
 * - Unlinking (or deleting the child) freezes the roll-ups: past months keep their totals.
 */

const ledgers = (db: Firestore) => db.collection("ledgers");

const asLedger = (
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): LinkableLedger => ({
  id,
  ...(data as Omit<LinkableLedger, "id">),
});

/**
 * Rebuild one month's roll-up for a sublog. Returns the parent to refresh, or null when
 * nothing rolls up (no link, a month before it, the parent gone, or the month frozen).
 */
const syncRollup = (
  db: Firestore,
  childRef: DocumentReference,
  month: string,
): Promise<DocumentReference | null> =>
  db.runTransaction(async (tx) => {
    const child = await tx.get(childRef);
    const link = child.get("parentLink") as ParentLink | undefined;
    if (!child.exists || !link || month < link.since) return null;
    const parentRef = ledgers(db).doc(link.ledgerId);
    const parent = await tx.get(parentRef);
    if (!parent.exists || parent.get("deleting") === true) return null;
    const rollupRef = parentRef.collection("rollups").doc(rollupDocId(month, childRef.id));
    const existing = await tx.get(rollupRef);
    if (existing.get("frozen") === true) return null;
    const entries = await tx.get(childRef.collection("entries").where("month", "==", month));
    const rollup = rollupFor(
      entries.docs.map((d) => d.data()),
      (parent.get("memberUids") as string[] | undefined) ?? [],
      link.categoryId,
    );
    if (rollup.entryCount === 0) {
      if (existing.exists) tx.delete(rollupRef);
    } else {
      tx.set(rollupRef, {
        month,
        childId: childRef.id,
        categoryId: link.categoryId,
        ...rollup,
        computedAt: FieldValue.serverTimestamp(),
      });
    }
    return parentRef;
  });

/** Recompute a parent's month with its roll-ups, then any budget alerts now due. */
const refreshParentMonth = async (
  db: Firestore,
  parentRef: DocumentReference,
  month: string,
): Promise<void> => {
  const aggregate = await recomputeMonth(db, parentRef, month, { withRollups: true });
  const parent = await parentRef.get();
  await alertBudgetsIfCurrent({
    db,
    ledgerRef: parentRef,
    ledger: parent.data() ?? {},
    month,
    aggregate,
  });
};

/**
 * Carry one month of a sublog into its parent. Best-effort: a failure is reported, never
 * thrown, so it can't hold up the sublog's own summary. The next write to that month, or
 * a member change, rebuilds it.
 */
export const rollUpMonth = async (
  db: Firestore,
  childRef: DocumentReference,
  month: string,
): Promise<void> => {
  try {
    const parentRef = await syncRollup(db, childRef, month);
    if (parentRef) await refreshParentMonth(db, parentRef, month);
  } catch (error) {
    reportError(error, { action: "sublog_rollup", extra: { month } });
  }
};

/**
 * Rebuild every month a link covers: the child's months from `since` on, plus any roll-up
 * already in the parent (a month the child has since emptied). With `replaceFrozen`
 * (a new link), frozen months of an earlier link from `since` on are handed to it.
 */
const rebuildLink = async (
  db: Firestore,
  childRef: DocumentReference,
  { replaceFrozen = false }: { replaceFrozen?: boolean } = {},
): Promise<void> => {
  const child = await childRef.get();
  const link = child.get("parentLink") as ParentLink | undefined;
  if (!link) return;
  const parentRef = ledgers(db).doc(link.ledgerId);
  const [childMonths, existing] = await Promise.all([
    childRef.collection("months").where(FieldPath.documentId(), ">=", link.since).select().get(),
    parentRef.collection("rollups").where("childId", "==", childRef.id).get(),
  ]);
  const months = new Set(childMonths.docs.map((d) => d.id));
  for (const doc of existing.docs) {
    const month = doc.get("month") as string;
    if (month < link.since) continue;
    if (doc.get("frozen") === true) {
      if (!replaceFrozen) continue;
      await doc.ref.delete();
    }
    months.add(month);
  }
  for (const month of [...months].sort()) await rollUpMonth(db, childRef, month);
};

/**
 * End a link: clear the child's parentLink, mark the parent's category as unlinked and
 * freeze its roll-ups, so past months keep what they showed. No-op if not linked.
 */
export const detachSublog = async (db: Firestore, childId: string): Promise<void> => {
  const childRef = ledgers(db).doc(childId);
  const parentRef = await db.runTransaction(async (tx) => {
    const child = await tx.get(childRef);
    const link = child.get("parentLink") as ParentLink | undefined;
    if (!link) return null;
    const ref = ledgers(db).doc(link.ledgerId);
    const parent = await tx.get(ref);
    tx.update(childRef, { parentLink: FieldValue.delete() });
    if (parent.exists) {
      const categories = (parent.get("categories") as LinkableCategory[] | undefined) ?? [];
      tx.update(ref, { categories: markCategoryUnlinked(categories, childId, Timestamp.now()) });
    }
    return parent.exists ? ref : null;
  });
  if (!parentRef) return;
  const live = await parentRef.collection("rollups").where("childId", "==", childId).get();
  const batch = db.batch();
  for (const doc of live.docs) {
    if (doc.get("frozen") !== true) batch.update(doc.ref, { frozen: true });
  }
  await batch.commit();
};

/** A parent being deleted: its sublogs stand alone again (its roll-ups go with it). */
export const releaseSublogs = async (
  db: Firestore,
  parentId: string,
  categories: unknown,
): Promise<void> => {
  const list = Array.isArray(categories) ? (categories as LinkableCategory[]) : [];
  for (const c of list.filter(isActiveSublog)) {
    const childRef = ledgers(db).doc(c.sublog!.ledgerId);
    const child = await childRef.get();
    const link = child.get("parentLink") as ParentLink | undefined;
    if (link?.ledgerId === parentId) await childRef.update({ parentLink: FieldValue.delete() });
  }
};

/**
 * Make one of your logs count as a category of another: { childId, parentId, since,
 * name? }. `since` ("YYYY-MM") is the first month that counts; the app sends the current
 * month, or the child's first month when the person includes its history.
 */
export const linkSublog = onCall(
  withSentryCall("linkSublog", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const req = parseLinkRequest(request.data);
    if (!req) {
      throw new HttpsError("invalid-argument", "Expected { childId, parentId, since, name? }.");
    }
    const db = getFirestore();
    const childRef = ledgers(db).doc(req.childId);
    const parentRef = ledgers(db).doc(req.parentId);

    const categoryId = await db.runTransaction(async (tx) => {
      const [child, parent] = await Promise.all([tx.get(childRef), tx.get(parentRef)]);
      if (!child.exists || !parent.exists) throw new HttpsError("not-found", "No such log.");
      const childLedger = asLedger(child.id, child.data());
      const parentLedger = asLedger(parent.id, parent.data());
      const error = validateLink({ parent: parentLedger, child: childLedger, callerUid: uid });
      if (error) {
        throw new HttpsError(
          error === "not-member" ? "permission-denied" : "failed-precondition",
          LINK_ERROR_MESSAGES[error],
        );
      }
      const added = addLinkedCategory(parentLedger.categories ?? [], {
        childId: child.id,
        name: linkedCategoryName(req.name, childLedger.title),
        linkedAt: Timestamp.now(),
      });
      tx.update(parentRef, { categories: added.categories });
      const link: ParentLink & { linkedAt: FieldValue } = {
        ledgerId: parent.id,
        categoryId: added.categoryId,
        since: req.since,
        linkedBy: uid,
        linkedAt: FieldValue.serverTimestamp(),
      };
      tx.update(childRef, { parentLink: link });
      return added.categoryId;
    });

    await rebuildLink(db, childRef, { replaceFrozen: true });
    return { categoryId };
  }),
);

/** End a sublog's link: { childId }. Any member of either log may. */
export const unlinkSublog = onCall(
  withSentryCall("unlinkSublog", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const childId = (request.data as { childId?: unknown } | null)?.childId;
    if (typeof childId !== "string" || !childId) {
      throw new HttpsError("invalid-argument", "Expected { childId }.");
    }
    const db = getFirestore();
    const child = await ledgers(db).doc(childId).get();
    if (!child.exists) throw new HttpsError("not-found", "No such log.");
    const link = child.get("parentLink") as ParentLink | undefined;
    if (!link) return { unlinked: false };
    const parent = await ledgers(db).doc(link.ledgerId).get();
    const inChild = ((child.get("memberUids") as string[]) ?? []).includes(uid);
    const inParent = ((parent.get("memberUids") as string[] | undefined) ?? []).includes(uid);
    if (!inChild && !inParent) {
      throw new HttpsError("permission-denied", "Only members of these logs can unlink them.");
    }
    await detachSublog(db, childId);
    return { unlinked: true };
  }),
);

const sameMembers = (a: unknown, b: unknown): boolean => {
  const x = new Set(Array.isArray(a) ? a : []);
  const y = new Set(Array.isArray(b) ? b : []);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

/**
 * Who counts in a roll-up depends on both logs' members, so a join (or a removal) on
 * either side rebuilds the link's live months. Frozen months stay as they were.
 */
export const rebuildSublogsOnMemberChange = onDocumentUpdated(
  "ledgers/{ledgerId}",
  withSentry("rebuildSublogsOnMemberChange", async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after || after.deleting === true) return;
    if (sameMembers(before.memberUids, after.memberUids)) return;
    const db = getFirestore();
    const { ledgerId } = event.params;

    if (after.parentLink) await rebuildLink(db, ledgers(db).doc(ledgerId));

    const categories = (after.categories as LinkableCategory[] | undefined) ?? [];
    for (const c of categories.filter(isActiveSublog)) {
      const childRef = ledgers(db).doc(c.sublog!.ledgerId);
      const child = await childRef.get();
      if ((child.get("parentLink") as ParentLink | undefined)?.ledgerId === ledgerId) {
        await rebuildLink(db, childRef);
      }
    }
  }),
);
