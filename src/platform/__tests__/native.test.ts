import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const capacitor = vi.hoisted(() => ({ native: false, platform: "web" }));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => capacitor.native,
    getPlatform: () => capacitor.platform,
  },
}));

import { isNative, nativePlatform } from "../native";
import { publicHost, PUBLIC_HOST } from "../links";

const runAs = (native: boolean, platform: string) => {
  capacitor.native = native;
  capacitor.platform = platform;
};

afterEach(() => runAs(false, "web"));

describe("native detection", () => {
  it("is the web in a browser", () => {
    expect(isNative()).toBe(false);
    expect(nativePlatform()).toBeNull();
  });

  it("names the app platform inside the shell", () => {
    runAs(true, "ios");
    expect(isNative()).toBe(true);
    expect(nativePlatform()).toBe("ios");
    runAs(true, "android");
    expect(nativePlatform()).toBe("android");
  });
});

describe("publicHost", () => {
  it("is the serving host on the web", () => {
    expect(publicHost()).toBe(window.location.host);
  });

  it("is the public domain in the app, which serves itself from localhost", () => {
    runAs(true, "ios");
    expect(publicHost()).toBe(PUBLIC_HOST);
  });
});
