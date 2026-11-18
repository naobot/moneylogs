// Before the walkthroughs: make sure the emulators are up and seeded, and start a dev
// server wired to them. After: stop it and write the contact sheet.
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { PASSWORD, auth, functionsEmulatorIsUp } from "../../scripts/emulator";
import { BASE_URL, E2E_PORT, OUTPUT_DIR } from "./env";
import { writeContactSheet } from "./contactSheet";

const EMULATOR_PORTS = { Auth: 9099, Firestore: 8888 };

async function portAnswers(port: number) {
  try {
    await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function requireEmulators() {
  for (const [name, port] of Object.entries(EMULATOR_PORTS)) {
    if (!(await portAnswers(port))) {
      throw new Error(
        `The ${name} emulator isn't answering on :${port}. Run firebase emulators:start.`,
      );
    }
  }
  if (!(await functionsEmulatorIsUp())) {
    throw new Error(
      "The Functions emulator isn't answering on :5001. Build the functions (cd functions && " +
        "npm run build) and restart the emulators: invites, joins and clean-up all need them.",
    );
  }
}

/** Seed once per emulator session: Alice's account says whether it's been done. */
async function ensureSeeded() {
  try {
    await signInWithEmailAndPassword(auth, "alice.vancouver@test.com", PASSWORD);
    await signOut(auth);
    return;
  } catch {
    // Not seeded yet.
  }
  console.log("Seeding the emulators first…");
  await run("npm", ["run", "seed-emulator"]);
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)),
    );
  });
}

async function startDevServer(): Promise<ChildProcess> {
  if (await portAnswers(E2E_PORT)) {
    throw new Error(
      `Something is already serving :${E2E_PORT}. Stop it: the walkthroughs start their own ` +
        "dev server so they know it talks to the emulators.",
    );
  }
  // VITE_FIREBASE_ENV=development is what points the app at the emulators. Variables
  // already in the environment win over .env files, so this holds whatever .env says.
  const server = spawn("npx", ["vp", "dev", "--port", String(E2E_PORT), "--strictPort"], {
    env: { ...process.env, VITE_FIREBASE_ENV: "development", VITE_EMULATOR_HOST: "localhost" },
    stdio: ["ignore", "ignore", "pipe"],
    detached: true,
  });
  let stderr = "";
  server.stderr?.on("data", (chunk) => (stderr += chunk));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`The dev server exited:\n${stderr}`);
    try {
      const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return server;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stopDevServer(server);
  throw new Error(`The dev server didn't come up on ${BASE_URL} within a minute.\n${stderr}`);
}

function stopDevServer(server: ChildProcess) {
  // npx → vp → vite: kill the whole group.
  try {
    if (server.pid) process.kill(-server.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

export default async function setup() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  await requireEmulators();
  await ensureSeeded();
  const server = await startDevServer();
  return async () => {
    stopDevServer(server);
    const sheet = writeContactSheet();
    if (sheet) console.log(`\nWalkthrough screenshots: ${sheet}`);
  };
}
