// Rewrites the iOS Swift Package symlinks to relative paths. Runs after every `cap update`
// (so after every `cap sync`) through the "capacitor:update:after" package script.
//
// capacitor.config.ts asks for symlinks for some plugins (see experimental.ios.spm), and
// Capacitor recreates ios/App/CapApp-SPM/symlinks/ on each update with *absolute* targets
// such as /Users/<you>/code/moneylogs/node_modules/... A committed absolute link breaks
// the iOS build in any other checkout (another clone, a worktree, CI), and every sync from
// a different folder dirties the tree. A relative link works wherever the repo lives.
import { existsSync, lstatSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const dir = resolve(import.meta.dirname, "..", "ios", "App", "CapApp-SPM", "symlinks");

// The hook runs for each platform; there's nothing to do outside an iOS update.
if (existsSync(dir)) {
  for (const name of readdirSync(dir)) {
    const link = join(dir, name);
    if (!lstatSync(link).isSymbolicLink()) continue;
    const target = readlinkSync(link);
    if (!isAbsolute(target)) continue;
    const relativeTarget = relative(dirname(link), target);
    unlinkSync(link);
    symlinkSync(relativeTarget, link);
    console.log(`[spm] ${name} → ${relativeTarget}`);
  }
}
