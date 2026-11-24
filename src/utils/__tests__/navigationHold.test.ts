import { describe, it, expect } from "vite-plus/test";
import { holdNavigation, isNavigationHeld, whileHoldingNavigation } from "../navigationHold";

describe("navigationHold", () => {
  it("holds until every hold is released, and a release counts once", () => {
    const a = holdNavigation();
    const b = holdNavigation();
    a();
    a();
    expect(isNavigationHeld()).toBe(true);
    b();
    expect(isNavigationHeld()).toBe(false);
  });

  it("holds for as long as a task runs, and lets go when it fails", async () => {
    let finish!: () => void;
    const running = whileHoldingNavigation(() => new Promise<void>((r) => (finish = r)));
    expect(isNavigationHeld()).toBe(true);
    finish();
    await running;
    expect(isNavigationHeld()).toBe(false);

    await expect(whileHoldingNavigation(() => Promise.reject(new Error("nope")))).rejects.toThrow(
      "nope",
    );
    expect(isNavigationHeld()).toBe(false);
  });
});
