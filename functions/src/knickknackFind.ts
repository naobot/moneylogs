import { DocumentReference, FieldValue, Firestore } from "firebase-admin/firestore";
import { BudgetCategory, budgetPaceRatio, HISTORY_MONTHS, historyPaceRatio } from "./ledgerBudget";
import {
  canRoll,
  dayIn,
  findableIn,
  findChance,
  loggedDaysBefore,
  RollMarker,
  rollFind,
} from "./knickknacks";

type MonthDoc = {
  totals?: Record<string, number>;
  byDay?: Record<string, Record<string, number>>;
  byCategory?: Record<string, Record<string, number>>;
};

/**
 * The buddy's one roll of the day for a person: after they log an entry, or on an
 * evening with nothing logged (rollQuietDay, which passes `onlyIf` to check that). The
 * marker at users/{id}/buddy/rolls is set on every roll, win or lose, so more entries
 * the same day do nothing. Finds land in users/{id}/knickknacks, which clients can read
 * (and mark seen) but never write.
 */
export const maybeFindKnickKnack = async ({
  db,
  ledgerRef,
  authorRef,
  categories,
  now = Date.now(),
  rand = Math.random,
  onlyIf,
}: {
  db: Firestore;
  ledgerRef: DocumentReference;
  authorRef: DocumentReference;
  categories: ReadonlyArray<BudgetCategory>;
  now?: number;
  rand?: () => number;
  /** An extra condition, checked once the day is known to still have its roll. */
  onlyIf?: (day: { today: string; timezone?: string }) => Promise<boolean>;
}): Promise<string | null> => {
  const userRef = db.collection("users").doc(authorRef.id);
  const user = await userRef.get();
  if (!user.exists) return null;

  const timezone = user.get("timezone") as string | undefined;
  const today = dayIn(now, timezone);
  const markerRef = userRef.collection("buddy").doc("rolls");
  // Most entries come on a day that's already rolled: skip the month reads for those.
  if (!canRoll({ marker: (await markerRef.get()).data() as RollMarker | undefined, today, now }))
    return null;
  if (onlyIf && !(await onlyIf({ today, timezone }))) return null;

  const findable = findableIn({ month: Number(today.slice(5, 7)), timezone });
  // The person's own current month, whatever month the entry was dated in.
  const month = today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const monthsBack = (n: number) => new Date(Date.UTC(y, m - 1 - n, 1)).toISOString().slice(0, 7);
  const months = ledgerRef.collection("months");
  // This month, then the history: last month first.
  const [current, ...history] = (
    await db.getAll(
      ...Array.from({ length: HISTORY_MONTHS + 1 }, (_, n) => months.doc(monthsBack(n))),
    )
  ).map((snap) => (snap.data() ?? {}) as MonthDoc);
  const chance = findChance({
    loggedDays: loggedDaysBefore(today, { [month]: current, [monthsBack(1)]: history[0] }),
    // Budgets when the log has them; otherwise how this month compares with recent ones.
    paceRatio:
      budgetPaceRatio({ categories, byCategory: current.byCategory ?? {}, month, now }) ??
      historyPaceRatio({
        totals: current.totals ?? {},
        history: history.map((h) => h.totals),
        month,
        now,
      }),
  });

  // Checked again inside the transaction: two entries at once must not both roll.
  return db.runTransaction(async (tx) => {
    const marker = (await tx.get(markerRef)).data() as RollMarker | undefined;
    if (!canRoll({ marker, today, now })) return null;
    tx.set(markerRef, { lastDay: today, lastAtMs: now });

    const item = rollFind({ rand, chance, findable });
    if (!item) return null;
    const findRef = userRef.collection("knickknacks").doc();
    tx.create(findRef, {
      item,
      ledgerId: ledgerRef.id,
      foundAt: FieldValue.serverTimestamp(),
      seenAt: null,
    });
    return item;
  });
};
