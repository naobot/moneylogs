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
  countedUids,
  latestCurrentMonth,
  LINK_ERROR_MESSAGES,
  LinkableCategory,
  LinkableLedger,
  linkedCategoryName,
  markCategoryUnlinked,
  newlyCountedUids,
  ParentLink,
  parseLinkRequest,
  parseUnlinkRequest,
  rollupDocId,
  rollupFor,
  SublogLink,
  sublogCountedNotificationId,
  validateLink,
} from "./ledgerRollup";
import { reportError, withSentry, withSentryCall } from "./sentry";
import { callerUserDoc, inbox } from "./friends";
import { isNotificationEnabled } from "./notificationPrefs";

/**
 * Sublogs: a ledger whose spending also counts as one category of another ledger.
 * Pure rules live in ledgerRollup.ts; this file does the Firestore work.
 *
 * - sublogLinks/{linkId}: the one record naming both ledgers (child, parent, line, first
 *   month). Server-only. Everything here goes through it, never through what clients can
 *   edit (categories) or read across the link.
 * - ledgers/{child}.parentLink and the parent's category marker carry only the link id:
 *   a ledger id is enough to join a ledger with room, so neither side learns the other's.
 * - ledgers/{parent}/rollups/{YYYY-MM}__{linkId} holds that month of the child, counting
 *   only entries by parent members. Rebuilt from the child's entries, so it's idempotent.
 * - ledgers/{parent}.hasRollups (server-only) makes its months/ docs merge them in
 *   (ledgerMonths.recomputeMonth), even after the line is renamed, archived or removed.
 * - Ending a link (unlinking, or deleting the child) freezes the roll-ups up to now, so
 *   past months keep their totals, and drops later (future-dated) ones.
 */

const ledgers = (db: Firestore) => db.collection("ledgers");
const links = (db: Firestore) => db.collection("sublogLinks");

const asLedger = (
  id: string,
  data: FirebaseFirestore.DocumentData | undefined,
): LinkableLedger => ({
  id,
  ...(data as Omit<LinkableLedger, "id">),
});

const memberOf = (snap: FirebaseFirestore.DocumentSnapshot, uid: string) =>
  ((snap.get("memberUids") as string[] | undefined) ?? []).includes(uid);

/**
 * Rebuild one month's roll-up for a link. Returns the parent to refresh, or null when
 * nothing rolls up (the link ended, a month before it, either ledger gone, or the
 * month frozen).
 */
const syncRollup = (
  db: Firestore,
  linkId: string,
  month: string,
): Promise<DocumentReference | null> =>
  db.runTransaction(async (tx) => {
    const link = await tx.get(links(db).doc(linkId));
    const data = link.data() as SublogLink | undefined;
    if (!data || data.endedAt || month < data.since) return null;
    const childRef = ledgers(db).doc(data.childId);
    const parentRef = ledgers(db).doc(data.parentId);
    const [child, parent] = await Promise.all([tx.get(childRef), tx.get(parentRef)]);
    if (!child.exists || !parent.exists || parent.get("deleting") === true) return null;
    const rollupRef = parentRef.collection("rollups").doc(rollupDocId(month, linkId));
    const existing = await tx.get(rollupRef);
    if (existing.get("frozen") === true) return null;
    const entries = await tx.get(childRef.collection("entries").where("month", "==", month));
    const rollup = rollupFor(
      entries.docs.map((d) => d.data()),
      (parent.get("memberUids") as string[] | undefined) ?? [],
      data.categoryId,
    );
    if (rollup.entryCount === 0) {
      if (existing.exists) tx.delete(rollupRef);
    } else {
      tx.set(rollupRef, {
        month,
        linkId,
        categoryId: data.categoryId,
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
export const rollUpMonth = async (db: Firestore, linkId: string, month: string): Promise<void> => {
  try {
    const parentRef = await syncRollup(db, linkId, month);
    if (parentRef) await refreshParentMonth(db, parentRef, month);
  } catch (error) {
    reportError(error, { action: "sublog_rollup", extra: { month } });
  }
};

/**
 * Rebuild every month a link covers: the child's months from `since` on, plus any of its
 * live roll-ups already in the parent (a month the child has since emptied).
 */
const rebuildLink = async (db: Firestore, linkId: string): Promise<void> => {
  const data = (await links(db).doc(linkId).get()).data() as SublogLink | undefined;
  if (!data || data.endedAt) return;
  const [childMonths, existing] = await Promise.all([
    ledgers(db)
      .doc(data.childId)
      .collection("months")
      .where(FieldPath.documentId(), ">=", data.since)
      .select()
      .get(),
    ledgers(db).doc(data.parentId).collection("rollups").where("linkId", "==", linkId).get(),
  ]);
  const months = new Set(childMonths.docs.map((d) => d.id));
  for (const doc of existing.docs) {
    const month = doc.get("month") as string;
    if (month >= data.since && doc.get("frozen") !== true) months.add(month);
  }
  for (const month of [...months].sort()) await rollUpMonth(db, linkId, month);
};

/**
 * A new link between two logs that were linked before takes over the months it covers:
 * the earlier links' frozen roll-ups from `since` on are removed, so nothing counts
 * twice. Months before `since` stay with the earlier line.
 */
const handOverFrozenMonths = async (db: Firestore, link: SublogLink): Promise<void> => {
  const earlier = await links(db)
    .where("childId", "==", link.childId)
    .where("parentId", "==", link.parentId)
    .get();
  const rollups = ledgers(db).doc(link.parentId).collection("rollups");
  for (const old of earlier.docs) {
    if (old.id === link.linkId) continue;
    const docs = await rollups.where("linkId", "==", old.id).get();
    for (const doc of docs.docs) {
      if ((doc.get("month") as string) >= link.since) await doc.ref.delete();
    }
  }
};

/**
 * End a link: record the end on it, clear the child's parentLink and mark the parent's
 * line as unlinked, then freeze its roll-ups up to now (past months keep what they
 * showed) and drop later, future-dated ones. With `callerUid`, the caller must be a
 * member of one of the two logs, checked inside the same transaction. Returns false if
 * the link had already ended (or never existed).
 */
export const detachSublog = async (
  db: Firestore,
  linkId: string,
  { callerUid }: { callerUid?: string } = {},
): Promise<boolean> => {
  const linkRef = links(db).doc(linkId);
  const parentRef = await db.runTransaction(async (tx) => {
    const link = await tx.get(linkRef);
    const data = link.data() as SublogLink | undefined;
    if (!data || data.endedAt) return null;
    const childRef = ledgers(db).doc(data.childId);
    const ref = ledgers(db).doc(data.parentId);
    const [child, parent] = await Promise.all([tx.get(childRef), tx.get(ref)]);
    if (callerUid !== undefined && !memberOf(child, callerUid) && !memberOf(parent, callerUid)) {
      throw new HttpsError("permission-denied", "Only members of these logs can unlink them.");
    }
    tx.update(linkRef, { endedAt: FieldValue.serverTimestamp() });
    if (child.exists && (child.get("parentLink") as ParentLink | undefined)?.linkId === linkId) {
      tx.update(childRef, { parentLink: FieldValue.delete() });
    }
    if (parent.exists) {
      const categories = (parent.get("categories") as LinkableCategory[] | undefined) ?? [];
      tx.update(ref, { categories: markCategoryUnlinked(categories, linkId, Timestamp.now()) });
    }
    return ref;
  });
  if (parentRef === null) return false;

  const horizon = latestCurrentMonth(Date.now());
  const rollups = await parentRef.collection("rollups").where("linkId", "==", linkId).get();
  const dropped: string[] = [];
  const batch = db.batch();
  for (const doc of rollups.docs) {
    const month = doc.get("month") as string;
    if (month > horizon) {
      batch.delete(doc.ref);
      dropped.push(month);
    } else if (doc.get("frozen") !== true) {
      batch.update(doc.ref, { frozen: true });
    }
  }
  await batch.commit();
  for (const month of dropped) await refreshParentMonth(db, parentRef, month);
  return true;
};

/**
 * Tell people that their spending in a sublog now counts in its parent, where members
 * who aren't in the sublog can see it: everyone in both logs on a link (bar whoever
 * linked), and whoever a join starts counting. A notice from an earlier link between the
 * same two logs is replaced, not stacked. Best-effort: reported, never thrown, so a
 * failed notice can't undo a link.
 */
const notifyCounted = async (
  db: Firestore,
  {
    linkId,
    uids,
    reason,
    actorName,
  }: {
    linkId: string;
    uids: ReadonlyArray<string>;
    reason: "linked" | "joined";
    actorName?: string;
  },
): Promise<void> => {
  if (uids.length === 0) return;
  try {
    const data = (await links(db).doc(linkId).get()).data() as SublogLink | undefined;
    if (!data || data.endedAt) return;
    const [child, parent] = await Promise.all([
      ledgers(db).doc(data.childId).get(),
      ledgers(db).doc(data.parentId).get(),
    ]);
    const lineName =
      ((parent.get("categories") as LinkableCategory[] | undefined) ?? []).find(
        (c) => c.id === data.categoryId,
      )?.name ?? "";
    // Everyone being told is in the sublog, so its member refs cover them.
    const refs = (child.get("members") as DocumentReference[] | undefined) ?? [];
    const users = refs.length ? await db.getAll(...refs) : [];
    const wanted = new Set(uids);
    const id = sublogCountedNotificationId(linkId);
    for (const user of users) {
      if (!user.exists || !wanted.has(user.get("userId") as string)) continue;
      if (!isNotificationEnabled(user.data(), "sublog_counted")) continue;
      const box = inbox(db, user.id);
      const batch = db.batch();
      const earlier = await box.where("groupId", "==", data.childId).get();
      for (const doc of earlier.docs) {
        if (
          doc.id !== id &&
          doc.get("type") === "sublog_counted" &&
          doc.get("parentId") === data.parentId
        ) {
          batch.delete(doc.ref);
        }
      }
      batch.set(box.doc(id), {
        type: "sublog_counted",
        logKind: "ledger",
        groupId: data.childId,
        groupName: (child.get("title") as string | undefined) ?? "",
        // Only ever sent to people in both logs, who can open either.
        parentId: data.parentId,
        parentTitle: (parent.get("title") as string | undefined) ?? "",
        lineName,
        reason,
        ...(actorName ? { actorName } : {}),
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
      });
      await batch.commit();
    }
  } catch (error) {
    reportError(error, { action: "sublog_counted_notice", level: "warning" });
  }
};

/** A parent being deleted: its sublogs stand alone again (its roll-ups go with it). */
export const releaseSublogs = async (db: Firestore, parentId: string): Promise<void> => {
  const live = await links(db).where("parentId", "==", parentId).get();
  for (const link of live.docs) {
    const data = link.data() as SublogLink;
    if (data.endedAt) continue;
    await db.runTransaction(async (tx) => {
      const childRef = ledgers(db).doc(data.childId);
      const child = await tx.get(childRef);
      tx.update(link.ref, { endedAt: FieldValue.serverTimestamp() });
      if (child.exists && (child.get("parentLink") as ParentLink | undefined)?.linkId === link.id) {
        tx.update(childRef, { parentLink: FieldValue.delete() });
      }
    });
  }
};

/**
 * Make one of your logs count as a category of another: { childId, parentId, since,
 * name? }. `since` ("YYYY-MM") is the first month that counts; the app sends the current
 * month, or "1970-01" when the person includes the log's history. The caller is in both
 * logs, so may name both.
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
    const linkRef = links(db).doc();
    const linkId = linkRef.id;

    const { record, counted } = await db.runTransaction(async (tx) => {
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
        linkId,
        name: linkedCategoryName(req.name, childLedger.title),
        linkedAt: Timestamp.now(),
      });
      const parentLink: ParentLink = {
        linkId,
        categoryId: added.categoryId,
        since: req.since,
        linkedBy: uid,
      };
      const link: SublogLink = { ...parentLink, childId: child.id, parentId: parent.id };
      tx.set(linkRef, { ...link, linkedAt: FieldValue.serverTimestamp() });
      tx.update(parentRef, { categories: added.categories, hasRollups: true });
      tx.update(childRef, {
        parentLink: { ...parentLink, linkedAt: FieldValue.serverTimestamp() },
      });
      return {
        record: link,
        counted: countedUids(childLedger.memberUids, parentLedger.memberUids),
      };
    });

    await handOverFrozenMonths(db, record);
    await rebuildLink(db, linkId);
    // Everyone else whose spending now shows in the parent hears about it.
    const me = await callerUserDoc(db, uid).catch(() => null);
    await notifyCounted(db, {
      linkId,
      uids: counted.filter((u) => u !== uid),
      reason: "linked",
      actorName: (me?.get("displayName") as string | undefined) ?? undefined,
    });
    return { categoryId: record.categoryId, linkId };
  }),
);

/**
 * End a sublog's link: { linkId }. Any member of either log may: the sublog's members see
 * the id on its parentLink, the parent's on its line.
 */
export const unlinkSublog = onCall(
  withSentryCall("unlinkSublog", async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    const req = parseUnlinkRequest(request.data);
    if (!req) throw new HttpsError("invalid-argument", "Expected { linkId }.");
    const unlinked = await detachSublog(getFirestore(), req.linkId, { callerUid: uid });
    return { unlinked };
  }),
);

const sameMembers = (a: unknown, b: unknown): boolean => {
  const x = new Set(Array.isArray(a) ? a : []);
  const y = new Set(Array.isArray(b) ? b : []);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

/**
 * Who counts in a roll-up depends on both logs' members, so a join (or a removal) on
 * either side rebuilds the link's live months, and tells whoever it starts counting.
 * Frozen months stay as they were.
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

    const [asChild, asParent] = await Promise.all([
      links(db).where("childId", "==", ledgerId).get(),
      links(db).where("parentId", "==", ledgerId).get(),
    ]);
    for (const link of [...asChild.docs, ...asParent.docs]) {
      const data = link.data() as SublogLink;
      if (data.endedAt) continue;
      await rebuildLink(db, link.id);
      // The other log's members, as they are now.
      const isChild = data.childId === ledgerId;
      const other = await ledgers(db)
        .doc(isChild ? data.parentId : data.childId)
        .get();
      const otherUids = other.get("memberUids") as string[] | undefined;
      const sides = isChild
        ? {
            before: { child: before.memberUids, parent: otherUids },
            after: { child: after.memberUids, parent: otherUids },
          }
        : {
            before: { child: otherUids, parent: before.memberUids },
            after: { child: otherUids, parent: after.memberUids },
          };
      await notifyCounted(db, {
        linkId: link.id,
        uids: newlyCountedUids(sides.before, sides.after),
        reason: "joined",
      });
    }
  }),
);
