// functions/scripts/award-tester-gear.ts (run from functions/)
//
// Give the shiny gear, the early testers' milestone knick-knack, to the people who tested
// the app, by their sign-in emails. Each one is written the same way as a live milestone
// (awardMilestoneOnce): the "Early Tester" achievement, an "achievement unlocked"
// notification (unless they've switched those off), and a find the budget buddy reveals.
// It stays with them: milestone knick-knacks can't be gifted.
//
// Safe to re-run: anyone who already has it is skipped.
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/award-tester-gear.ts --email a@example.com --email b@example.com
//   npx tsx scripts/award-tester-gear.ts --file testers.txt     # one email per line
//   ... --write    # writes (without it: a dry run that checks every account)
//
// Keep the testers' list out of the repo.
//
// Against the emulators instead:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8888 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx tsx ...
import fs from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { awardMilestoneOnce } from "../src/awardMilestone";
import { EARLY_TESTER, milestoneAchievementId } from "../src/milestones";

declare const process: { argv: string[]; exit(code?: number): never };

const args = process.argv.slice(2);
const write = args.includes("--write");
const values = (name: string) =>
  args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));

const fromFiles = values("file").flatMap((path) =>
  fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean),
);
const emails = [...new Set([...values("email"), ...fromFiles].map((e) => e.toLowerCase()))];

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const main = async () => {
  if (!emails.length) throw new Error("Pass --email (repeatable) or --file.");
  console.log(
    `${EARLY_TESTER} for ${emails.length} ${emails.length === 1 ? "person" : "people"}${write ? "" : " (dry run, pass --write to write)"}`,
  );

  let given = 0;
  const problems: string[] = [];
  for (const email of emails) {
    try {
      const { uid } = await getAuth().getUserByEmail(email);
      const users = await db.collection("users").where("userId", "==", uid).limit(1).get();
      if (users.empty) throw new Error("no user doc");
      const userRef = users.docs[0].ref;
      if (!write) {
        const held = await userRef
          .collection("achievements")
          .doc(milestoneAchievementId(EARLY_TESTER))
          .get();
        console.log(`  ${email}: ${held.exists ? "already has it" : "would get it"}`);
        continue;
      }
      const awarded = await awardMilestoneOnce({ db, userId: userRef.id, item: EARLY_TESTER });
      if (awarded) given++;
      console.log(`  ${email}: ${awarded ? "✅ given" : "already has it"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push(`${email}: ${message}`);
      console.log(`  ${email}: ⚠️  ${message}`);
    }
  }
  if (write) console.log(`Gave ${given}.`);
  if (problems.length) {
    console.error(`${problems.length} couldn't be checked or given; fix and re-run.`);
    process.exit(1);
  }
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
