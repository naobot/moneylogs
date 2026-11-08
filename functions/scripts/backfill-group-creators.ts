/**
 * One-off: record `createdBy` (creator's auth uid) on social log groups created before the
 * field existed, so their creators can delete them.
 *
 * Proposal: the app prepends each joining member (addMemberToGroupFn), so the creator is the
 * LAST entry in `members`. That's a heuristic — review the dry run before applying.
 *
 * Usage (from functions/):
 *   Production (needs `gcloud auth application-default login`):
 *     npx tsx scripts/backfill-group-creators.ts                 # dry run
 *     npx tsx scripts/backfill-group-creators.ts --apply         # write all proposals
 *     npx tsx scripts/backfill-group-creators.ts --apply --only <groupId,...>
 *     npx tsx scripts/backfill-group-creators.ts --apply --set <groupId>=<authUid>
 *   Emulator: prefix with FIRESTORE_EMULATOR_HOST=localhost:8888
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, DocumentReference } from "firebase-admin/firestore";

declare const process: { argv: string[]; exit(code?: number): never };

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = new Set((argValue("--only") ?? "").split(",").filter(Boolean));
const overrides = new Map(
  (argValue("--set") ?? "")
    .split(",")
    .filter(Boolean)
    .map((pair) => pair.split("=") as [string, string]),
);

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const main = async () => {
  const groups = await db.collection("log_groups").get();
  const pending = groups.docs.filter((g) => !g.get("createdBy"));
  console.log(`${groups.size} groups, ${pending.length} without createdBy.\n`);

  let written = 0;
  for (const group of pending) {
    if (only.size > 0 && !only.has(group.id)) continue;
    const members = (group.get("members") ?? []) as DocumentReference[];
    const title = group.get("title");
    const range = [group.get("startWallClock"), group.get("endWallClock")]
      .filter(Boolean)
      .join(" → ");

    let uid = overrides.get(group.id);
    let who = "(override)";
    if (!uid) {
      const lastRef = members[members.length - 1];
      const user = lastRef ? await lastRef.get() : undefined;
      uid = user?.get("userId");
      who = user?.exists ? `${user.get("displayName")} <${user.get("email")}>` : "(no member)";
    }

    console.log(`${group.id}  "${title}"  ${range}`);
    console.log(`    ${members.length} members; proposed creator: ${who} uid=${uid ?? "?"}`);
    if (!uid) {
      console.log("    SKIP: couldn't resolve a creator; use --set <groupId>=<authUid>\n");
      continue;
    }
    if (apply) {
      await group.ref.update({ createdBy: uid });
      written++;
      console.log("    written\n");
    } else {
      console.log("");
    }
  }
  console.log(
    apply
      ? `Done: wrote createdBy on ${written} groups.`
      : "Dry run: nothing written. Re-run with --apply.",
  );
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
