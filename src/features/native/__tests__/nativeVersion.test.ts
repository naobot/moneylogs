import { describe, expect, it } from "vite-plus/test";

// The store builds must carry the same version as the web build. `npm version` keeps them
// in step (scripts/sync-native-version.mjs); this catches a bump made any other way.
// Play also rejects an upload whose versionCode isn't higher than the last one.
// Read as text at build time, the same way other tests read firestore.rules.
const files = import.meta.glob<string>(
  ["/package.json", "/android/app/build.gradle", "/ios/App/App.xcodeproj/project.pbxproj"],
  { query: "?raw", import: "default", eager: true },
);
const read = (path: string) => {
  const text = files[`/${path}`];
  if (text === undefined) throw new Error(`${path} not found`);
  return text;
};

const { version } = JSON.parse(read("package.json")) as { version: string };
const [major, minor, patch] = version.split(".").map(Number);
const build = major * 10000 + minor * 100 + patch;
const fix = "run `node scripts/sync-native-version.mjs` (or bump with `npm version`)";

describe("native app versions", () => {
  it(`Android matches package.json (${version}); if not, ${fix}`, () => {
    const gradle = read("android/app/build.gradle");
    expect(gradle).toContain(`versionName "${version}"`);
    expect(gradle).toContain(`versionCode ${build}`);
  });

  it(`iOS matches package.json (${version}); if not, ${fix}`, () => {
    const pbxproj = read("ios/App/App.xcodeproj/project.pbxproj");
    const marketing = [...pbxproj.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);
    const builds = [...pbxproj.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1]);
    expect(new Set(marketing)).toEqual(new Set([version]));
    expect(new Set(builds)).toEqual(new Set([String(build)]));
  });
});
