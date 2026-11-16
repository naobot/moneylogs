// functions/scripts/backfill-profiles.ts (run from functions/)
//
// One-off: write profiles/{id} for every existing users/{id}. New and edited users are
// kept in step by the mirrorProfile Cloud Function; this covers people who haven't
// touched their user doc since it was deployed. Safe to re-run.
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/backfill-profiles.ts            # dry run, prints counts
//   npx tsx scripts/backfill-profiles.ts --write    # writes
//
// Against the emulator instead: FIRESTORE_EMULATOR_HOST=127.0.0.1:8888 npx tsx ...
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { publicProfile } from "../src/profiles";

declare const process: { argv: string[]; exit(code?: number): never };

const write = process.argv.includes("--write");

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const main = async () => {
  const users = await db.collection("users").get();
  console.log(`${users.size} user docs${write ? "" : " (dry run, pass --write to write)"}`);
  if (!write) return;

  let batch = db.batch();
  let pending = 0;
  for (const user of users.docs) {
    batch.set(db.collection("profiles").doc(user.id), {
      ...publicProfile(user.data()),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (++pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  console.log(`✅ wrote ${users.size} profiles`);
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
