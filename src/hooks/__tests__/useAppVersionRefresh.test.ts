import { describe, it, expect } from "vite-plus/test";
import { shouldPromptUpdate } from "@/hooks/useAppVersionRefresh";

const AWAY = 4 * 60 * 60 * 1000;

describe("shouldPromptUpdate", () => {
  it("is false when the running build id is unknown", () => {
    expect(shouldPromptUpdate({ bootBuildId: null, fetchedBuildId: "abc", hiddenMs: AWAY })).toBe(
      false,
    );
  });

  it("is false when the fetched build id is unknown", () => {
    expect(shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: null, hiddenMs: AWAY })).toBe(
      false,
    );
  });

  it("is false when the build is unchanged", () => {
    expect(shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "abc", hiddenMs: AWAY })).toBe(
      false,
    );
  });

  it("is false when a newer build exists but the tab wasn't away long enough", () => {
    expect(
      shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: AWAY - 1 }),
    ).toBe(false);
  });

  it("is true when a newer build exists and the tab was away past the threshold", () => {
    expect(shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: AWAY })).toBe(
      true,
    );
  });

  it("respects a custom awayMs threshold", () => {
    expect(
      shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: 60, awayMs: 100 }),
    ).toBe(false);
    expect(
      shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: 100, awayMs: 100 }),
    ).toBe(true);
  });
});
