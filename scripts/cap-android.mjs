// Development build of the Android app, run on a USB device or an Android Studio emulator
// against the local Firebase emulators. `npm run cap:android [-- --target <id>]`
//
// 1. Checks the JDK: this project's Gradle (8.14) runs on JDK 17–24, while recent
//    Android Studio bundles a newer one. CI uses 21.
// 2. Builds and syncs (npm run cap:sync:dev), then `cap run android` with any extra args.
// 3. Forwards the emulator ports to every connected device with `adb reverse`, so the
//    app reaches them at localhost (see src/config/firebase-config.ts), then relaunches
//    the app so it connects straight away. This has to come last: `cap run` restarts
//    adb, which drops any forwards made before it.
//
// `npm run android:forward` does step 3 alone, e.g. after replugging the phone.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const MIN_JDK = 17;
const MAX_JDK = 24;

const fail = (message) => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed`);
};

const findAdb = () => {
  const sdks = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), "Library/Android/sdk"),
  ];
  for (const sdk of sdks) {
    const adb = sdk && join(sdk, "platform-tools", "adb");
    if (adb && existsSync(adb)) return adb;
  }
  return "adb"; // on PATH, if anywhere
};

const checkJdk = () => {
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", "java") : "java";
  let output;
  try {
    output = spawnSync(java, ["-version"], { encoding: "utf8" }).stderr ?? "";
  } catch {
    output = "";
  }
  const match = /version "(?:1\.)?(\d+)/.exec(output);
  const hint =
    "Point JAVA_HOME at a JDK 17–24 (CI uses 21), e.g.\n" +
    "  export JAVA_HOME=$(/usr/libexec/java_home -v 21)";
  if (!match) fail(`No Java found (${java}). ${hint}`);
  const major = Number(match[1]);
  if (major < MIN_JDK || major > MAX_JDK) {
    fail(`Java ${major} can't run this project's Gradle. ${hint}`);
  }
};

const emulatorPorts = () => {
  const { emulators = {} } = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
  const defaults = { auth: 9099, firestore: 8888, storage: 9199, functions: 5001 };
  return Object.entries(defaults).map(([name, port]) => emulators[name]?.port ?? port);
};

const appId = () => {
  const config = readFileSync(join(root, "capacitor.config.ts"), "utf8");
  const match = /appId:\s*["']([^"']+)["']/.exec(config);
  if (!match) fail("Couldn't read appId from capacitor.config.ts");
  return match[1];
};

const forwardAndRelaunch = ({ relaunch }) => {
  const adb = findAdb();
  let devices;
  try {
    devices = execFileSync(adb, ["devices"], { encoding: "utf8" })
      .split("\n")
      .slice(1)
      .map((line) => line.split("\t"))
      .filter(([, state]) => state?.trim() === "device")
      .map(([serial]) => serial);
  } catch {
    fail("adb isn't available. Install the Android SDK platform-tools (Android Studio).");
  }
  if (!devices.length)
    fail("No device connected. Plug in a phone with USB debugging, or start an emulator.");

  const ports = emulatorPorts();
  const id = appId();
  for (const serial of devices) {
    for (const port of ports) {
      execFileSync(adb, ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`]);
    }
    console.log(`↔ ${serial}: forwarded emulator ports ${ports.join(", ")}`);
    if (relaunch) {
      execFileSync(adb, ["-s", serial, "shell", "am", "force-stop", id]);
      execFileSync(
        adb,
        ["-s", serial, "shell", "monkey", "-p", id, "-c", "android.intent.category.LAUNCHER", "1"],
        {
          stdio: "ignore",
        },
      );
      console.log(`↻ ${serial}: relaunched ${id}`);
    }
  }
};

const args = process.argv.slice(2);
if (args.includes("--forward-only")) {
  forwardAndRelaunch({ relaunch: false });
} else {
  checkJdk();
  run("npm", ["run", "cap:sync:dev"]);
  run("npx", ["cap", "run", "android", ...args]);
  forwardAndRelaunch({ relaunch: true });
}
