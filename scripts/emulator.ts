// scripts/emulator.ts
//
// The Firebase client wired to the local emulators, plus "owner" access (which bypasses
// security rules) for what only backend jobs write. Shared by seed-emulator.ts and
// personas.ts. Client writes go through the rules exactly as the app's do; reach for the
// owner helpers only for data no client could write (backdated timestamps, scheduled-job
// output).
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

export const PROJECT_ID = "moneylogs-89ebf";
export const FIRESTORE_HOST = "localhost:8888";
export const FUNCTIONS_URL = "http://localhost:5001";
export const APP_URL = "http://localhost:5173";
/** Every seeded and persona account signs in with this. */
export const PASSWORD = "test123";

const app = initializeApp({
  apiKey: "mock-api-key",
  authDomain: "mock-auth-domain",
  projectId: PROJECT_ID,
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id",
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
connectFirestoreEmulator(db, "localhost", 8888);
connectFunctionsEmulator(functions, "localhost", 5001);

/**
 * Confirm an account's email, as opening the link would. Accounts made today aren't
 * grandfathered (src/utils/confirmedEmail.ts), so without this they can't send friend
 * requests, invite links, gifts or log invites.
 */
export async function markEmailVerified(uid: string) {
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify({ localId: uid, emailVerified: true }),
    },
  );
  if (!res.ok) throw new Error(`Couldn't confirm ${uid}'s email: ${await res.text()}`);
}

export async function functionsEmulatorIsUp() {
  try {
    await fetch(FUNCTIONS_URL, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Owner writes (bypass rules) through the Firestore emulator's REST API.
// ---------------------------------------------------------------------------
/** A document reference for an owner write, e.g. `docPath("users/abc")`. */
export class DocPath {
  constructor(readonly path: string) {}
}
export const docPath = (path: string) => new DocPath(path);

export type Value =
  | DocPath
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Value[]
  | { [key: string]: Value };

const encode = (v: Value): unknown => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (v instanceof DocPath)
    return { referenceValue: `projects/${PROJECT_ID}/databases/(default)/documents/${v.path}` };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v) } };
};
// Undefined fields are left out, as the Admin SDK's ignoreUndefinedProperties would.
const encodeFields = (data: { [key: string]: Value }) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, encode(v)]),
  );

/**
 * Write a document with owner access. With `merge`, only the given top-level fields
 * change and the rest of the document stays; without it, the document is replaced.
 */
export async function ownerWrite(
  path: string,
  data: { [key: string]: Value },
  { merge = false }: { merge?: boolean } = {},
) {
  const mask = merge
    ? "?" +
      Object.keys(data)
        .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
        .join("&")
    : "";
  const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`Owner write to ${path} failed: ${res.status} ${await res.text()}`);
}
