// functions/scripts/set-admin.ts (run from functions/)
//
// Give an account the `admin` custom claim, which unlocks the /admin page and the admin
// callables (src/admin.ts), or take it away with --revoke. Other custom claims on the
// account are kept. The /admin page refreshes its ID token on open, so no re-login is needed.
//
// Uses the Admin SDK with Application Default Credentials:
//   gcloud auth application-default login
//   npx tsx scripts/set-admin.ts --email someone@example.com
//   ... --revoke   # remove the claim instead
//   ... --write    # writes (without it: a dry run that shows the current claims)
//
// Against the emulators instead:
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx tsx ...
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

declare const process: { argv: string[]; exit(code?: number): never };

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const write = process.argv.includes("--write");
const revoke = process.argv.includes("--revoke");
const email = arg("email");

initializeApp({ projectId: "moneylogs-89ebf" });

const main = async () => {
  if (!email) throw new Error("Pass --email.");
  const user = await getAuth().getUserByEmail(email);
  const claims = { ...user.customClaims };
  console.log(`${email} (${user.uid}) has claims ${JSON.stringify(claims)}`);

  if (revoke) delete claims.admin;
  else claims.admin = true;
  console.log(
    `${revoke ? "revoke" : "grant"} admin → ${JSON.stringify(claims)}` +
      `${write ? "" : " (dry run, pass --write to write)"}`,
  );
  if (!write) return;

  await getAuth().setCustomUserClaims(user.uid, claims);
  console.log(`✅ ${revoke ? "revoked" : "granted"} admin`);
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
