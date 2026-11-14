// Copies package.json's version into the native projects, so a store build carries the
// same version as the web build it was made from. Runs on `npm version` (see the
// "version" script) and can be run by hand: node scripts/sync-native-version.mjs
//
// iOS MARKETING_VERSION / Android versionName = "5.6.0".
// Build number (iOS CURRENT_PROJECT_VERSION / Android versionCode) = 50600: derived from
// the version, so it always increases with it and never needs storing. Minor and patch
// must stay below 100.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) throw new Error(`package.json version "${version}" isn't major.minor.patch`);
const [major, minor, patch] = match.slice(1).map(Number);
if (minor > 99 || patch > 99) throw new Error(`minor and patch must be below 100: ${version}`);
const build = major * 10000 + minor * 100 + patch;

const rewrite = (file, replacements) => {
  const path = resolve(root, file);
  let text = readFileSync(path, "utf8");
  for (const [pattern, value] of replacements) {
    if (!pattern.test(text)) throw new Error(`${file}: no match for ${pattern}`);
    text = text.replace(pattern, value);
  }
  writeFileSync(path, text);
};

rewrite("ios/App/App.xcodeproj/project.pbxproj", [
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
  [/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`],
]);
rewrite("android/app/build.gradle", [
  [/versionCode \d+/, `versionCode ${build}`],
  [/versionName "[^"]*"/, `versionName "${version}"`],
]);

console.log(`Native projects set to ${version} (build ${build})`);
