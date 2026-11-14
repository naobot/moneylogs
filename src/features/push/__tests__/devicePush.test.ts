import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/config/firebase-config", () => ({ db: {} }));
vi.mock("@capacitor-firebase/messaging", () => ({ FirebaseMessaging: {} }));

import { installId, pushState, pushTapPath } from "../devicePush";

afterEach(() => window.localStorage.clear());

describe("installId", () => {
  it("is created once and then reused", () => {
    const first = installId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(installId()).toBe(first);
  });
});

describe("pushState", () => {
  it("is on only when turned on here and still allowed", () => {
    expect(pushState("granted", true)).toBe("on");
    expect(pushState("granted", false)).toBe("off");
    expect(pushState("prompt", true)).toBe("off");
  });

  it("is blocked when the phone's settings deny it", () => {
    expect(pushState("denied", true)).toBe("blocked");
    expect(pushState("denied", false)).toBe("blocked");
  });
});

describe("pushTapPath", () => {
  it("opens the inbox at the tapped notification", () => {
    expect(pushTapPath({ notificationId: "comment_c1" })).toBe("/notifications?open=comment_c1");
  });

  it("ignores payloads without one", () => {
    expect(pushTapPath({})).toBeNull();
    expect(pushTapPath(undefined)).toBeNull();
  });
});
