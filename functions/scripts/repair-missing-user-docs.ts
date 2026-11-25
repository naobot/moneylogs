// functions/scripts/repair-missing-user-docs.ts (run from functions/)
//
// Find Auth accounts with no users/ doc (registration cut off between making the account
// and the doc) and make the doc, the same one the ensureUserDoc callable makes
// (src/ensureUserDocPlan.ts): they're sent through the welcome wizard on next load.
//
// Uses the Admin SDK with Application Default Credentials:
//   npx tsx scripts/repair-missing-user-docs.ts              # dry run, accounts from the last 30 days
//   ... --days 90                                             # look further back
//   ... --uid <uid>                                           # only this account
//   ... --write                                               # make the docs
import { initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { planNewUserDoc } from "../src/ensureUserDocPlan";

declare const process: { argv: string[] };

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const write = process.argv.includes("--write");
const onlyUid = arg("uid");
const days = Number(arg("days") ?? 30);

initializeApp({ projectId: "moneylogs-89ebf" });
const auth = getAuth();
const db = getFirestore();

const main = async () => {
  const since = Date.now() - days * 86400e3;
  const candidates: UserRecord[] = [];
  if (onlyUid) {
    candidates.push(await auth.getUser(onlyUid));
  } else {
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      candidates.push(...page.users.filter((u) => Date.parse(u.metadata.creationTime) >= since));
      pageToken = page.pageToken;
    } while (pageToken);
  }

  let missing = 0;
  for (const u of candidates) {
    const users = db.collection("users");
    const found = await users.where("userId", "==", u.uid).limit(1).get();
    if (!found.empty) continue;
    missing++;
    const provider = u.providerData[0]?.providerId ?? "anonymous";
    console.log(
      `missing: uid=${u.uid} provider=${provider} created=${u.metadata.creationTime} lastSignIn=${u.metadata.lastSignInTime}`,
    );
    if (!write) continue;
    const id = await db.runTransaction(async (tx) => {
      const again = await tx.get(users.where("userId", "==", u.uid).limit(1));
      if (!again.empty) return again.docs[0].id;
      const ref = users.doc();
      tx.create(ref, {
        ...planNewUserDoc(u.uid, {
          email: u.email,
          firebase: { sign_in_provider: provider === "anonymous" ? "anonymous" : provider },
        }),
        createdAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    });
    console.log(`  created users/${id}`);
  }
  console.log(
    `${candidates.length} account(s) checked, ${missing} without a user doc${write ? "" : " (dry run; --write to fix)"}`,
  );
};

void main();
