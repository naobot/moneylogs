// Emits dist/version.json after the build so a long-open client tab can detect a
// newer deploy (see src/hooks/useAppVersionRefresh.ts). buildId comes from the git
// short SHA — it changes on every deploy of new code even when package.json's
// version isn't bumped; falls back to a timestamp when git isn't available.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");

let buildId;
try {
  buildId = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  buildId = String(Date.now());
}

const payload = {
  buildId,
  version: process.env.npm_package_version ?? "unknown",
  builtAt: new Date().toISOString(),
};

mkdirSync(distDir, { recursive: true });
writeFileSync(resolve(distDir, "version.json"), JSON.stringify(payload, null, 2));
console.log(`📝 wrote dist/version.json (${payload.buildId})`);
