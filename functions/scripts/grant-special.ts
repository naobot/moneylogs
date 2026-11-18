// functions/scripts/grant-special.ts (run from functions/)
//
// Grant copies of a special knick-knack (rarity "special": never found by chance) to
// one account, by its sign-in email. They arrive already kept (seen), straight in the
// knick-knack drawer, rather than as a pile of finds for the buddy to reveal one by one.
// Like ordinary finds, they can be given to friends.
//
// Not idempotent: every --write run adds `--count` more copies. The admin panel (/admin)
// can grant any non-milestone item the same way (src/knickknackGrants.ts).
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/grant-special.ts --email someone@example.com --item mini_robot_charm --count 50
//   ... --write    # writes (without it: a dry run that checks the account and item)
//
// Against the emulators instead:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8888 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx tsx ...
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { KNICK_KNACK_FINDS } from "../src/knickknacks";
import { grantKept } from "../src/knickknackGrants";

declare const process: { argv: string[]; exit(code?: number): never };

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const write = process.argv.includes("--write");
const email = arg("email");
const item = arg("item");
const count = Number(arg("count") ?? 1);
const MAX_COUNT = 200;

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const main = async () => {
  if (!email || !item) throw new Error("Pass --email and --item.");
  const info = (KNICK_KNACK_FINDS as Record<string, { rarity: string } | undefined>)[item];
  if (info?.rarity !== "special") throw new Error(`${item} isn't a special knick-knack.`);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count must be a whole number from 1 to ${MAX_COUNT}.`);
  }

  const { uid } = await getAuth().getUserByEmail(email);
  const users = await db.collection("users").where("userId", "==", uid).limit(1).get();
  if (users.empty) throw new Error(`No user doc for ${email}.`);
  const userRef = users.docs[0].ref;
  console.log(
    `${count} × ${item} for user ${userRef.id}${write ? "" : " (dry run, pass --write to write)"}`,
  );
  if (!write) return;

  await grantKept(db, userRef, item, count);
  console.log(`✅ granted ${count} × ${item}`);
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
