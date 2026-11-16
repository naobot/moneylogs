// functions/scripts/backfill-milestones.ts (run from functions/)
//
// One-off: give milestone knick-knacks (and their achievements and notifications) to
// people who earned them before they existed:
//   - copper coin: has logged a financial entry
//   - silver / gold / extra shiny gold coin: logged financial entries on 10 / 30 / 100
//     days in a row (check-ins weren't recorded before, so entry days stand in for them)
//   - heart-shaped leaf: has written a social entry
//   - paper crane: has commented on someone else's social entry
//   - friendship bracelet: has a friend
// Each is written the same way as a live award (src/awardMilestone.ts), so people get
// the usual "achievement unlocked" notification (unless they've switched it off) and
// the budget buddy reveals the knick-knack. It also folds past entry days into each
// person's streak, so a streak that's still going counts from where it began.
//
// Safe to re-run: anyone already holding a milestone's achievement is skipped.
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/backfill-milestones.ts            # dry run, prints what it would give
//   npx tsx scripts/backfill-milestones.ts --write    # writes
//
// Against the emulator instead: FIRESTORE_EMULATOR_HOST=127.0.0.1:8888 npx tsx ...
import { initializeApp } from "firebase-admin/app";
import { DocumentReference, getFirestore, Timestamp } from "firebase-admin/firestore";
import { writeMilestone } from "../src/awardMilestone";
import { StreakMarker } from "../src/coins";
import { dayIn, KNICK_KNACK_FINDS } from "../src/knickknacks";
import { PastActivity, planBackfill } from "../src/milestoneBackfill";
import { isCommentOnOthers, milestoneAchievementId } from "../src/milestones";

declare const process: { argv: string[]; exit(code?: number): never };

const write = process.argv.includes("--write");

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const MILESTONES = Object.entries(KNICK_KNACK_FINDS)
  .filter(([, { rarity }]) => rarity === "milestone")
  .map(([id]) => id);

const refId = (value: unknown): string | undefined => {
  const id = (value as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" ? id : undefined;
};

/** Everything people have done that earns a milestone, by user doc id. */
const gatherActivity = async (timezones: Map<string, string | undefined>) => {
  const activity = new Map<string, PastActivity & { entryDays: string[] }>();
  const of = (userId: string) => {
    let a = activity.get(userId);
    if (!a) {
      a = { entryDays: [], wroteSocialEntry: false, commentedOnOthers: false, hasFriend: false };
      activity.set(userId, a);
    }
    return a;
  };

  // Financial entries: ledgers/{id}/entries/{id}, by the day they were created.
  const entries = await db.collectionGroup("entries").get();
  for (const entry of entries.docs) {
    if (entry.ref.parent.parent?.parent.id !== "ledgers") continue;
    const userId = refId(entry.get("author"));
    const createdAt = entry.get("createdAt") as Timestamp | undefined;
    if (!userId || !createdAt?.toMillis) continue;
    of(userId).entryDays.push(dayIn(createdAt.toMillis(), timezones.get(userId)));
  }

  // Social entries, and who wrote each (for comments on someone else's).
  const posts = await db.collection("log_posts").get();
  const postAuthor = new Map<string, string>();
  for (const post of posts.docs) {
    const userId = refId(post.get("author"));
    if (!userId) continue;
    postAuthor.set(post.id, userId);
    of(userId).wroteSocialEntry = true;
  }

  const comments = await db.collectionGroup("comments").get();
  for (const comment of comments.docs) {
    const post = comment.ref.parent.parent;
    if (post?.parent.id !== "log_posts") continue;
    const userId = refId(comment.get("authorId"));
    if (userId && isCommentOnOthers(userId, postAuthor.get(post.id))) {
      of(userId).commentedOnOthers = true;
    }
  }

  const friendships = await db.collection("friendships").where("status", "==", "accepted").get();
  for (const pair of friendships.docs) {
    for (const userId of (pair.get("users") ?? []) as string[]) of(userId).hasFriend = true;
  }

  return activity;
};

/** Plan and (with --write) apply one person's backfill in a transaction. */
const backfillUser = (userRef: DocumentReference, activity: PastActivity) =>
  db.runTransaction(async (tx) => {
    const markerRef = userRef.collection("buddy").doc("streak");
    const achievementRefs = MILESTONES.map((item) =>
      userRef.collection("achievements").doc(milestoneAchievementId(item)),
    );
    const [user, markerSnap, ...achievements] = await tx.getAll(
      userRef,
      markerRef,
      ...achievementRefs,
    );
    if (!user.exists) return [];

    const held = new Set(MILESTONES.filter((_, i) => achievements[i].exists));
    const plan = planBackfill({
      activity,
      held,
      marker: markerSnap.data() as StreakMarker | undefined,
    });
    if (!write) return plan.items;

    if (plan.marker) tx.set(markerRef, plan.marker, { merge: true });
    const ledgerId = (user.get("personalLedgerId") as string | undefined) ?? null;
    for (const item of plan.items) writeMilestone(tx, user, item, ledgerId);
    return plan.items;
  });

const main = async () => {
  const users = await db.collection("users").get();
  const timezones = new Map(
    users.docs.map((u) => [u.id, u.get("timezone") as string | undefined] as const),
  );
  const activity = await gatherActivity(timezones);
  console.log(
    `${users.size} users, ${activity.size} with activity${write ? "" : " (dry run, pass --write to write)"}`,
  );

  const counts = new Map<string, number>();
  let people = 0;
  for (const [userId, a] of activity) {
    if (!timezones.has(userId)) continue; // deleted users
    const items = await backfillUser(db.collection("users").doc(userId), a);
    if (!items.length) continue;
    people++;
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    console.log(`  ${userId}: ${items.join(", ")}`);
  }

  console.log(`${write ? "✅ gave" : "would give"} milestones to ${people} people:`);
  for (const item of MILESTONES) console.log(`  ${item}: ${counts.get(item) ?? 0}`);
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
