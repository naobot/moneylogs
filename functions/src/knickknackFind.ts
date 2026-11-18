import { DocumentReference, FieldValue, Firestore } from "firebase-admin/firestore";
import { BudgetCategory, budgetPaceRatio, HISTORY_MONTHS, historyPaceRatio } from "./ledgerBudget";
import {
  dayIn,
  findableIn,
  hourIn,
  loggedDaysBefore,
  openSlot,
  rollDay,
  RollMarker,
  rollFind,
  visitRollsLeft,
} from "./knickknacks";
import {
  LuckState,
  luckOf,
  luckTier,
  nextLuckState,
  rollChance,
  spendingGrade,
  spendingScore,
} from "./luck";

type MonthDoc = {
  totals?: Record<string, number>;
  byDay?: Record<string, Record<string, number>>;
  byCategory?: Record<string, Record<string, number>>;
};

/**
 * Spending habits across the person's financial logs (luck.ts spendingScore): each log
 * they're a member of that isn't archived, graded on this month's budget pace, or on how
 * it compares with recent months when it has no budgets.
 */
const spendingAcrossLogs = async ({
  db,
  uid,
  today,
  now,
}: {
  db: Firestore;
  uid: string;
  today: string;
  now: number;
}): Promise<number> => {
  const ledgers = (
    await db.collection("ledgers").where("memberUids", "array-contains", uid).get()
  ).docs.filter((l) => l.get("archived") !== true && l.get("deleting") !== true);
  if (!ledgers.length) return spendingScore([]);

  // The person's own current month, then the history: last month first.
  const month = today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const monthsBack = (n: number) => new Date(Date.UTC(y, m - 1 - n, 1)).toISOString().slice(0, 7);
  const span = HISTORY_MONTHS + 1;
  const snaps = await db.getAll(
    ...ledgers.flatMap((l) =>
      Array.from({ length: span }, (_, n) => l.ref.collection("months").doc(monthsBack(n))),
    ),
  );

  return spendingScore(
    ledgers.map((ledger, i) => {
      const [current, ...history] = snaps
        .slice(i * span, (i + 1) * span)
        .map((s) => (s.data() ?? {}) as MonthDoc);
      const categories = (ledger.get("categories") ?? []) as BudgetCategory[];
      return {
        loggedDays: loggedDaysBefore(today, { [month]: current, [monthsBack(1)]: history[0] }),
        grade: spendingGrade(
          budgetPaceRatio({ categories, byCategory: current.byCategory ?? {}, month, now }) ??
            historyPaceRatio({
              totals: current.totals ?? {},
              history: history.map((h) => h.totals),
              month,
              now,
            }),
        ),
      };
    }),
  );
};

/**
 * Work out luck from the person's logs and this momentum, and save its tier for them to see
 * (users/{id}/luck/current, words only). Returns the luck, for a roll.
 */
export const refreshLuckTier = async ({
  db,
  userRef,
  uid,
  today,
  now,
  momentum,
}: {
  db: Firestore;
  userRef: DocumentReference;
  uid: string;
  today: string;
  now: number;
  momentum: number;
}): Promise<number> => {
  const luck = luckOf({ spending: await spendingAcrossLogs({ db, uid, today, now }), momentum });
  await userRef
    .collection("luck")
    .doc("current")
    .set({ tier: luckTier(luck), updatedAt: FieldValue.serverTimestamp() });
  return luck;
};

/**
 * A check-in's chance at a knick-knack: a signed-in visit (`kind: "visit"`, from
 * dailyCheckIn) or a logged entry (`kind: "entry"`, from recomputeLedgerMonth or an
 * import). It moves the person's momentum, works out their luck and saves its tier (the
 * only part they see), then rolls the day's slot for this kind of check-in if it's still
 * open (knickknacks.ts). Finds land in users/{id}/knickknacks, which clients can read (and
 * mark seen) but never write; an entry's find remembers its log, so that log's buddy can
 * reveal it. `more` says whether a visit later today could still roll.
 */
export const takeDailyChance = async ({
  db,
  userRef,
  kind,
  ledgerId = null,
  now = Date.now(),
  rand = Math.random,
}: {
  db: Firestore;
  userRef: DocumentReference;
  kind: "visit" | "entry";
  ledgerId?: string | null;
  now?: number;
  rand?: () => number;
}): Promise<{ item: string | null; more: boolean }> => {
  const user = await userRef.get();
  const uid = user.get("userId") as string | undefined;
  if (!user.exists || !uid) return { item: null, more: false };

  const timezone = user.get("timezone") as string | undefined;
  const today = dayIn(now, timezone);
  const hour = hourIn(now, timezone);
  const buddy = userRef.collection("buddy");
  const luckRef = buddy.doc("luck");
  const markerRef = buddy.doc("rolls");

  // Momentum first: it moves once a day per check-in, roll or no roll.
  const momentum = await db.runTransaction(async (tx) => {
    const [luckSnap, streakSnap] = await Promise.all([
      tx.get(luckRef),
      tx.get(buddy.doc("streak")),
    ]);
    const state = luckSnap.data() as LuckState | undefined;
    const next = nextLuckState({
      state,
      today,
      entry: kind === "entry",
      streakDays: streakSnap.get("days") as number | undefined,
    });
    if (next) tx.set(luckRef, next);
    return { value: next?.momentum ?? state?.momentum ?? 0, changed: !!next };
  });

  const day = rollDay({
    marker: (await markerRef.get()).data() as RollMarker | undefined,
    today,
    now,
  });
  const slot = day && openSlot(day, { kind, hour });
  // Nothing to roll and luck unchanged: skip the log reads.
  if (!slot && !momentum.changed) return { item: null, more: visitRollsLeft(day) };

  const luck = await refreshLuckTier({ db, userRef, uid, today, now, momentum: momentum.value });
  if (!slot) return { item: null, more: visitRollsLeft(day) };

  const findable = findableIn({ month: Number(today.slice(5, 7)), timezone });
  // Checked again inside the transaction: two check-ins at once must not both roll a slot.
  return db.runTransaction(async (tx) => {
    const current = rollDay({
      marker: (await tx.get(markerRef)).data() as RollMarker | undefined,
      today,
      now,
    });
    const open = current && openSlot(current, { kind, hour });
    if (!current || !open) return { item: null, more: visitRollsLeft(current) };

    const item = rollFind({
      rand,
      chance: rollChance({ luck, findsToday: current.finds }),
      findable,
    });
    const after = {
      ...current,
      slots: [...current.slots, open],
      finds: current.finds + (item ? 1 : 0),
    };
    tx.set(markerRef, after);
    if (item) {
      tx.create(userRef.collection("knickknacks").doc(), {
        item,
        ledgerId: kind === "entry" ? ledgerId : null,
        foundAt: FieldValue.serverTimestamp(),
        seenAt: null,
      });
    }
    return { item, more: visitRollsLeft(after) };
  });
};
