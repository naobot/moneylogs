import type { NativePlatform } from "@/platform";

/**
 * The `config/app` document. Old native builds keep talking to production rules and
 * functions, so when a release can't stay compatible with them, raising
 * `minNativeVersion` asks everyone below it to update from the store.
 */
export type AppConfig = {
  minNativeVersion?: string;
  iosStoreUrl?: string;
  androidStoreUrl?: string;
};

const parts = (version: string): number[] | null => {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version.trim());
  if (!match) return null;
  return [match[1], match[2], match[3]].map((part) => Number(part ?? 0));
};

/**
 * Whether `version` is older than `minimum`, comparing major.minor.patch. Anything
 * unreadable counts as not older, so a bad config never locks people out.
 */
export const isVersionBelow = (version: string, minimum: string): boolean => {
  const have = parts(version);
  const need = parts(minimum);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i] !== need[i]) return have[i] < need[i];
  }
  return false;
};

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export type RequiredUpdate = { storeUrl?: string };

/**
 * What the gate needs to show, or null when this build may keep running: no minimum
 * set, the build meets it, or the config is malformed.
 */
export const requiredUpdate = (
  config: unknown,
  version: string,
  platform: NativePlatform,
): RequiredUpdate | null => {
  if (!config || typeof config !== "object") return null;
  const data = config as Record<string, unknown>;
  const minimum = text(data.minNativeVersion);
  if (!minimum || !isVersionBelow(version, minimum)) return null;
  return { storeUrl: text(platform === "ios" ? data.iosStoreUrl : data.androidStoreUrl) };
};
