// App Store build of the iOS app. `npm run ios:release [-- --upload]`
//
// 1. Copies package.json's version into the native projects (sync-native-version.mjs),
//    makes a production web build and syncs it (npm run cap:sync).
// 2. Archives the App scheme (Release) to ios/App/build/moneylogs-<version>.xcarchive.
// 3. Exports an App Store .ipa next to it and checks its push entitlement: the project
//    keeps aps-environment = development for simulator and USB builds, and the export
//    has to re-sign it as production, or push never reaches App Store / TestFlight users.
// 4. With --upload, uploads the archive to App Store Connect with the Apple ID signed in
//    to Xcode (Settings → Accounts). Without it, opens the archive in Xcode's Organizer,
//    where Distribute App → App Store Connect uploads it.
//
// Signing is automatic (team N95N7S65JJ); -allowProvisioningUpdates lets xcodebuild create
// the distribution certificate and profile on first use.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const iosApp = join(root, "ios/App");
const buildDir = join(iosApp, "build");
const TEAM_ID = "N95N7S65JJ";
const upload = process.argv.includes("--upload");

const fail = (message) => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};

const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed`);
};

const exportOptions = (destination) => {
  const path = join(buildDir, `ExportOptions-${destination}.plist`);
  writeFileSync(
    path,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>${destination}</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
`,
  );
  return path;
};

if (process.platform !== "darwin") fail("iOS builds need macOS with Xcode.");
if (spawnSync("xcodebuild", ["-version"]).status !== 0)
  fail("xcodebuild not found: install Xcode.");
if (!existsSync(join(iosApp, "App/GoogleService-Info.plist")))
  fail("ios/App/App/GoogleService-Info.plist is missing (see docs/mobile.md, checklist step 2).");

run("node", ["scripts/sync-native-version.mjs"]);
run("npm", ["run", "cap:sync"]);

const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const archive = join(buildDir, `moneylogs-${version}.xcarchive`);
const exportDir = join(buildDir, `export-${version}`);
mkdirSync(buildDir, { recursive: true });
rmSync(archive, { recursive: true, force: true });
rmSync(exportDir, { recursive: true, force: true });

run(
  "xcodebuild",
  [
    "-project",
    "App.xcodeproj",
    "-scheme",
    "App",
    "-configuration",
    "Release",
    "-destination",
    "generic/platform=iOS",
    "-archivePath",
    archive,
    "-allowProvisioningUpdates",
    "archive",
  ],
  iosApp,
);

run(
  "xcodebuild",
  [
    "-exportArchive",
    "-archivePath",
    archive,
    "-exportPath",
    exportDir,
    "-exportOptionsPlist",
    exportOptions("export"),
    "-allowProvisioningUpdates",
  ],
  iosApp,
);

const ipa = readdirSync(exportDir).find((name) => name.endsWith(".ipa"));
if (!ipa) fail(`No .ipa in ${exportDir}`);
const unzipped = join(exportDir, "unzipped");
execFileSync("unzip", ["-q", "-o", join(exportDir, ipa), "-d", unzipped]);
const entitlements = execFileSync(
  "codesign",
  ["-d", "--entitlements", ":-", join(unzipped, "Payload/App.app")],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
);
rmSync(unzipped, { recursive: true, force: true });
const aps = /<key>aps-environment<\/key>\s*<string>([^<]+)<\/string>/.exec(entitlements)?.[1];
if (aps !== "production")
  fail(`The exported app's aps-environment is "${aps}", not "production": push would not work.`);
console.log(`\n✔ ${ipa} ${version} exported with aps-environment = production`);

if (upload) {
  run(
    "xcodebuild",
    [
      "-exportArchive",
      "-archivePath",
      archive,
      "-exportOptionsPlist",
      exportOptions("upload"),
      "-allowProvisioningUpdates",
    ],
    iosApp,
  );
  console.log(
    `\n✔ Uploaded ${version} to App Store Connect. It shows in TestFlight once processed.`,
  );
} else {
  run("open", [archive]);
  console.log("\nOpened in Xcode's Organizer: Distribute App → App Store Connect to upload.");
}
