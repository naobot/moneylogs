import { describe, expect, it } from "vite-plus/test";
import { isVersionBelow, requiredUpdate } from "../minVersion";

describe("isVersionBelow", () => {
  it("compares major, minor and patch in order", () => {
    expect(isVersionBelow("5.5.0", "5.6.0")).toBe(true);
    expect(isVersionBelow("5.10.0", "5.9.9")).toBe(false);
    expect(isVersionBelow("4.99.99", "5.0.0")).toBe(true);
    expect(isVersionBelow("5.6.1", "5.6.0")).toBe(false);
  });

  it("is false for an equal version", () => {
    expect(isVersionBelow("5.6.0", "5.6.0")).toBe(false);
    expect(isVersionBelow("5.6", "5.6.0")).toBe(false);
  });

  it("never blocks on something unreadable", () => {
    expect(isVersionBelow("dev", "5.0.0")).toBe(false);
    expect(isVersionBelow("5.0.0", "")).toBe(false);
  });
});

describe("requiredUpdate", () => {
  const config = {
    minNativeVersion: "5.7.0",
    iosStoreUrl: "https://apps.apple.com/app/id1",
    androidStoreUrl: "https://play.google.com/store/apps/details?id=app.moneylogs",
  };

  it("asks an older build to update, with its own store link", () => {
    expect(requiredUpdate(config, "5.6.0", "ios")).toEqual({ storeUrl: config.iosStoreUrl });
    expect(requiredUpdate(config, "5.6.0", "android")).toEqual({
      storeUrl: config.androidStoreUrl,
    });
  });

  it("lets a current build through", () => {
    expect(requiredUpdate(config, "5.7.0", "ios")).toBeNull();
  });

  it("fails open on a missing or malformed config", () => {
    expect(requiredUpdate(undefined, "1.0.0", "ios")).toBeNull();
    expect(requiredUpdate({}, "1.0.0", "ios")).toBeNull();
    expect(requiredUpdate({ minNativeVersion: 7 }, "1.0.0", "ios")).toBeNull();
  });

  it("still gates without a store link", () => {
    expect(requiredUpdate({ minNativeVersion: "9.0.0" }, "1.0.0", "android")).toEqual({
      storeUrl: undefined,
    });
  });
});
