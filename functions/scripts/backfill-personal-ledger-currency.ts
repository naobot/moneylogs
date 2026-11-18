/**
 * One-off: bring each personal log's `defaultCurrency` in line with its owner's
 * `users.defaultCurrency`.
 *
 * Before PR #208, changing the default in /me (or the currency prompt) only updated the
 * user doc. The personal log kept the currency it was created with, so new entries kept
 * starting in it. Nothing else can set a personal log's currency, so any mismatch is that
 * bug. Users who never chose a default, and personal logs that have since been deleted,
 * are skipped.
 *
 * Usage (from functions/):
 *   Production (needs `gcloud auth application-default login`):
 *     npx tsx scripts/backfill-personal-ledger-currency.ts                 # dry run
 *     npx tsx scripts/backfill-personal-ledger-currency.ts --apply         # write the fixes
 *     npx tsx scripts/backfill-personal-ledger-currency.ts --apply --only <userDocId,...>
 *   Emulator: prefix with FIRESTORE_EMULATOR_HOST=localhost:8888
 *
 * Re-running is safe: logs already in line are left alone.
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

declare const process: { argv: string[]; exit(code?: number): never };

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = new Set((argValue("--only") ?? "").split(",").filter(Boolean));

initializeApp({ projectId: "moneylogs-89ebf" });
const db = getFirestore();

const main = async () => {
  const users = await db.collection("users").get();
  const candidates = users.docs.filter(
    (u) =>
      (only.size === 0 || only.has(u.id)) &&
      typeof u.get("defaultCurrency") === "string" &&
      typeof u.get("personalLedgerId") === "string",
  );
  console.log(
    `${users.size} users, ${candidates.length} with both a default currency and a personal log.\n`,
  );

  // One batched read for all their personal logs.
  const ledgerRefs = candidates.map((u) => db.collection("ledgers").doc(u.get("personalLedgerId")));
  const ledgers = ledgerRefs.length > 0 ? await db.getAll(...ledgerRefs) : [];

  let inLine = 0;
  let missing = 0;
  const fixes: Array<{ userDocId: string; ledgerId: string; from: string; to: string }> = [];
  candidates.forEach((user, i) => {
    const ledger = ledgers[i];
    if (!ledger.exists) {
      missing++;
      return;
    }
    const to = user.get("defaultCurrency") as string;
    const from = ledger.get("defaultCurrency") as string;
    if (from === to) inLine++;
    else fixes.push({ userDocId: user.id, ledgerId: ledger.id, from, to });
  });

  // Ids only: no names or emails in the output.
  for (const f of fixes) {
    console.log(`users/${f.userDocId}  ledgers/${f.ledgerId}  ${f.from ?? "(none)"} → ${f.to}`);
  }
  console.log(
    `\n${fixes.length} to fix, ${inLine} already in line, ${missing} personal logs deleted.`,
  );

  if (!apply) {
    console.log("Dry run: nothing written. Re-run with --apply.");
    process.exit(0);
  }

  const writer = db.bulkWriter();
  for (const f of fixes) {
    void writer.update(db.collection("ledgers").doc(f.ledgerId), { defaultCurrency: f.to });
  }
  await writer.close();
  console.log(`Done: updated ${fixes.length} personal logs.`);
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
