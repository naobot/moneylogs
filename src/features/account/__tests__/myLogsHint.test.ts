import { describe, it, expect } from "vite-plus/test";
import { myLogsHint } from "@/features/account/myLogsHint";

describe("myLogsHint", () => {
  it("lists non-zero counts in a fixed order", () => {
    expect(myLogsHint({ financial: 1, ongoing: 2, upcoming: 0, past: 5, archived: 3 })).toBe(
      "1 financial · 2 ongoing · 5 past · 3 archived",
    );
  });

  it("says so when there are no logs", () => {
    expect(myLogsHint({ financial: 0, ongoing: 0, upcoming: 0, past: 0, archived: 0 })).toBe(
      "none yet",
    );
  });
});
