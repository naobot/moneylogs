import { DocumentReference, FieldValue, Firestore, DocumentData } from "firebase-admin/firestore";
import { budgetAlerts, BudgetCategory } from "./ledgerBudget";
import { isNotificationEnabled } from "./notificationPrefs";

// Firestore's gRPC code for a create() whose document already exists.
const ALREADY_EXISTS = 6;

/**
 * After a month is recomputed: send any budget alert that month hasn't sent yet to every
 * member who wants it. `budgetAlerts/{month}.sent` records what has gone out, so a
 * month that stays over budget costs one read per entry, not a read per member. Members
 * can't read or write it (no rule); deleteLog's recursive delete removes it.
 */
export const notifyLedgerBudgets = async ({
  db,
  ledgerRef,
  ledger,
  month,
  byCategory,
  now = Date.now(),
}: {
  db: Firestore;
  ledgerRef: DocumentReference;
  ledger: DocumentData;
  month: string;
  byCategory: { [categoryId: string]: { [currency: string]: number } };
  now?: number;
}) => {
  const alerts = budgetAlerts({
    ledgerId: ledgerRef.id,
    ledgerName: typeof ledger.title === "string" ? ledger.title : "",
    month,
    categories: (ledger.categories ?? []) as BudgetCategory[],
    byCategory,
    now,
  });
  if (!alerts.length) return;

  const markerRef = ledgerRef.collection("budgetAlerts").doc(month);
  const sent = ((await markerRef.get()).get("sent") ?? {}) as Record<string, unknown>;
  const fresh = alerts.filter((alert) => !sent[alert.id]);
  if (!fresh.length) return;

  const memberRefs = ((ledger.members ?? []) as unknown[]).filter(
    (ref): ref is DocumentReference => !!ref && typeof (ref as DocumentReference).id === "string",
  );
  const members = memberRefs.length
    ? await db.getAll(...memberRefs.map((ref) => db.collection("users").doc(ref.id)))
    : [];

  for (const member of members) {
    if (!member.exists) continue;
    const userData = member.data();
    for (const alert of fresh) {
      if (!isNotificationEnabled(userData, alert.data.type)) continue;
      if (alert.categoryScoped && !isNotificationEnabled(userData, "budget_category")) continue;
      try {
        await member.ref
          .collection("notifications")
          .doc(alert.id)
          .create({ ...alert.data, createdAt: FieldValue.serverTimestamp(), readAt: null });
      } catch (error) {
        if ((error as { code?: number }).code !== ALREADY_EXISTS) throw error;
      }
    }
  }

  await markerRef.set(
    { sent: Object.fromEntries(fresh.map((alert) => [alert.id, true])) },
    { merge: true },
  );
};
