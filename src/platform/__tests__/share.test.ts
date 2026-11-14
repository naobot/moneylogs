import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const native = vi.hoisted(() => ({ on: false, share: vi.fn() }));
vi.mock("../native", () => ({ isNative: () => native.on }));
vi.mock("@capacitor/share", () => ({ Share: { share: native.share } }));

import { canShare, shareLink } from "../share";

const link = { title: "Join Lisbon", url: "https://moneylogs.app/g/abc/invite" };
const setWebShare = (fn: unknown) =>
  Object.defineProperty(navigator, "share", { value: fn, configurable: true });

afterEach(() => {
  native.on = false;
  native.share.mockReset();
  setWebShare(undefined);
});

describe("shareLink", () => {
  it("uses the native sheet in the app", async () => {
    native.on = true;
    native.share.mockResolvedValue({});
    expect(canShare()).toBe(true);
    expect(await shareLink(link)).toBe("shared");
    expect(native.share).toHaveBeenCalledWith(expect.objectContaining(link));
  });

  it("treats a dismissed native sheet as cancelled", async () => {
    native.on = true;
    native.share.mockRejectedValue(new Error("Share canceled"));
    expect(await shareLink(link)).toBe("cancelled");
  });

  it("uses the Web Share API where the browser has it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setWebShare(share);
    expect(canShare()).toBe(true);
    expect(await shareLink(link)).toBe("shared");
    expect(share).toHaveBeenCalledWith(link);
  });

  it("tells a dismissed browser sheet apart from a failure", async () => {
    setWebShare(vi.fn().mockRejectedValue(Object.assign(new Error(), { name: "AbortError" })));
    expect(await shareLink(link)).toBe("cancelled");
    setWebShare(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    expect(await shareLink(link)).toBe("unavailable");
  });

  it("is unavailable in a browser without a share sheet", async () => {
    expect(canShare()).toBe(false);
    expect(await shareLink(link)).toBe("unavailable");
  });
});
