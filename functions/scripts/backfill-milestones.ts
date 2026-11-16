// functions/scripts/backfill-milestones.ts (run from functions/)
//
// One-off: give the friendship bracelet (and its achievement and notification) to
// everyone who already had a friend before it existed. The other milestone knick-knacks
// aren't backfilled: they're given the next time someone does the thing that earns them
// (logs a financial or social entry, comments on someone else's entry, checks in).
// The bracelet needs this because a friendship that already exists is never accepted
// again.
//
// Each bracelet is written the same way as a live award (awardMilestoneOnce), so people
// get the usual "achievement unlocked" notification (unless they've switched it off) and
// the budget buddy reveals it. Safe to re-run: anyone who already has it is skipped.
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/backfill-milestones.ts            # dry run, prints who'd get one
//   npx tsx scripts/backfill-milestones.ts --write    # writes
//
// Against the emulator instead: FIRESTORE_EMULATOR_HOST=127.0.0.1:8888 npx tsx ...
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { awardMilestoneOnce } from "../src/awardMilestone";
import { FIRST_FRIEND, milestoneAchievementId } from "../src/milestones";

declare const process: { argv: string[]; exit(code?: number): never };

const write = process.argv.includes("--write");

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const main = async () => {
  const friendships = await db.collection("friendships").where("status", "==", "accepted").get();
  const people = [
    ...new Set(friendships.docs.flatMap((pair) => (pair.get("users") ?? []) as string[])),
  ];
  console.log(
    `${friendships.size} friendships, ${people.length} people with a friend${write ? "" : " (dry run, pass --write to write)"}`,
  );

  let given = 0;
  for (const userId of people) {
    const userRef = db.collection("users").doc(userId);
    if (!write) {
      const [user, held] = await db.getAll(
        userRef,
        userRef.collection("achievements").doc(milestoneAchievementId(FIRST_FRIEND)),
      );
      if (user.exists && !held.exists) {
        given++;
        console.log(`  ${userId}`);
      }
      continue;
    }
    if (await awardMilestoneOnce({ db, userId, item: FIRST_FRIEND })) {
      given++;
      console.log(`  ${userId}`);
    }
  }
  console.log(`${write ? "✅ gave" : "would give"} ${given} friendship bracelets`);
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
