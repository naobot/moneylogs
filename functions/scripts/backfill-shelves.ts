// functions/scripts/backfill-shelves.ts (run from functions/)
//
// One-off: write shelves/{id} for every user who has kept knick-knacks. New changes are
// kept in step by the mirrorShelf Cloud Function; this covers finds from before it was
// deployed. Run it right after deploying, since profile pages read only shelves/ (and
// can no longer read other people's knick-knacks directly). Safe to re-run.
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/backfill-shelves.ts            # dry run, prints counts
//   npx tsx scripts/backfill-shelves.ts --write    # writes
//
// Against the emulator instead: FIRESTORE_EMULATOR_HOST=127.0.0.1:8888 npx tsx ...
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ShelfFind, shelfOf } from "../src/shelf";

declare const process: { argv: string[]; exit(code?: number): never };

const write = process.argv.includes("--write");

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const main = async () => {
  const users = await db.collection("users").get();
  let shelves = 0;
  for (const user of users.docs) {
    const finds = await user.ref.collection("knickknacks").where("seenAt", "!=", null).get();
    if (finds.empty) continue;
    const items = shelfOf(finds.docs.map((d) => d.data() as ShelfFind));
    shelves++;
    if (write) {
      await db
        .collection("shelves")
        .doc(user.id)
        .set({ items, updatedAt: FieldValue.serverTimestamp() });
    }
  }
  console.log(
    `${users.size} users, ${shelves} with a shelf${write ? ": ✅ written" : " (dry run, pass --write to write)"}`,
  );
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
