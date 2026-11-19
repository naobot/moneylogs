// functions/scripts/forest-gift.ts (run from functions/)
//
// Send knick-knacks to one account as gifts from "a forest spirit" rather than from any
// user. They arrive like a friend's gift: wrapped (unseen) in the knick-knack drawer, with
// a "gift_received" notification (unless they've switched those off), so the push and
// email digest go out as usual. Once opened, the shelf says "gift from a forest spirit".
// Like any gift, they can be passed on to a friend (who then sees it as a gift from that
// friend). Milestone knick-knacks can't be sent: they're
// earned, not given.
//
// Not idempotent: every --write run sends `--count` more. The admin panel (/admin) does the
// same from the app; both write through src/knickknackGrants.ts.
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/forest-gift.ts --email someone@example.com --item acorn
//   npx tsx scripts/forest-gift.ts --user <userDocId> --item mini_robot_charm --count 3
//   ... --write    # writes (without it: a dry run that checks the account and item)
//
// Against the emulators instead:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8888 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx tsx ...
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { FOREST_SPIRIT_NAME, spiritGiftBlock } from "../src/giftsPlan";
import { KNICK_KNACK_FINDS } from "../src/knickknacks";
import { sendSpiritGift } from "../src/knickknackGrants";
import { isNotificationEnabled } from "../src/notificationPrefs";

declare const process: { argv: string[]; exit(code?: number): never };

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const write = process.argv.includes("--write");
const email = arg("email");
const userDocId = arg("user");
const item = arg("item");
const count = Number(arg("count") ?? 1);
const MAX_COUNT = 20;

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const findUser = async () => {
  if (userDocId) {
    const snap = await db.collection("users").doc(userDocId).get();
    if (!snap.exists) throw new Error(`No user doc ${userDocId}.`);
    return snap;
  }
  const { uid } = await getAuth().getUserByEmail(email!);
  const users = await db.collection("users").where("userId", "==", uid).limit(1).get();
  if (users.empty) throw new Error(`No user doc for ${email}.`);
  return users.docs[0];
};

const main = async () => {
  if ((!email && !userDocId) || (email && userDocId) || !item) {
    throw new Error("Pass --item and one of --email or --user.");
  }
  const block = spiritGiftBlock(item, KNICK_KNACK_FINDS);
  if (block === "unknown") throw new Error(`${item} isn't a knick-knack.`);
  if (block === "milestone") throw new Error(`${item} is a milestone: it's earned, not given.`);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count must be a whole number from 1 to ${MAX_COUNT}.`);
  }

  const user = await findUser();
  const notify = isNotificationEnabled(user.data(), "gift_received");
  console.log(
    `${count} × ${item} from ${FOREST_SPIRIT_NAME} to user ${user.id} ` +
      `(${user.get("displayName") ?? "no name"}), ${notify ? "with" : "without"} a notification` +
      `${write ? "" : " (dry run, pass --write to write)"}`,
  );
  if (!write) return;

  await sendSpiritGift(db, user, item, count);
  console.log(`🌲 sent ${count} × ${item}`);
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
