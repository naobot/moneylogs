// Applies CORS configuration to the Firebase Storage bucket.
//
// Option A — service account key (recommended):
//   1. Firebase Console → Project Settings → Service Accounts → Generate new private key
//   2. Save the downloaded file as serviceAccountKey.json (it is gitignored)
//   3. node scripts/set-storage-cors.js ./serviceAccountKey.json
//
// Option B — Application Default Credentials (requires gcloud CLI):
//   gcloud auth application-default login
//   node scripts/set-storage-cors.js

import { Storage } from "../functions/node_modules/@google-cloud/storage/build/esm/src/index.js";
import { createRequire } from "module";
import { resolve } from "path";
const corsConfig = createRequire(import.meta.url)("../cors.json");

const BUCKET = "moneylogs-89ebf.firebasestorage.app";
const PROJECT = "moneylogs-89ebf";

async function main() {
  const keyPath = process.argv[2];
  const opts = { projectId: PROJECT };
  if (keyPath) opts.keyFilename = resolve(keyPath);

  const storage = new Storage(opts);
  await storage.bucket(BUCKET).setCorsConfiguration(corsConfig);
  console.log(`CORS applied to gs://${BUCKET}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
