import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const native = vi.hoisted(() => ({ on: false, share: vi.fn(), writeFile: vi.fn() }));
vi.mock("../native", () => ({ isNative: () => native.on }));
vi.mock("@capacitor/share", () => ({ Share: { share: native.share } }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: native.writeFile },
}));

import { canShare, canShareImages, shareImage, shareLink } from "../share";

const link = { title: "Join Lisbon", url: "https://moneylogs.app/g/abc/invite" };
const setWebShare = (fn: unknown) =>
  Object.defineProperty(navigator, "share", { value: fn, configurable: true });

const setCanShare = (fn: unknown) =>
  Object.defineProperty(navigator, "canShare", { value: fn, configurable: true });

afterEach(() => {
  native.on = false;
  native.share.mockReset();
  native.writeFile.mockReset();
  setWebShare(undefined);
  setCanShare(undefined);
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

describe("shareImage", () => {
  const card = () => ({
    blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
    filename: "moneylogs-today.png",
    title: "My day",
  });

  it("shares a cache file through the native sheet in the app", async () => {
    native.on = true;
    native.writeFile.mockResolvedValue({ uri: "file:///cache/moneylogs-today.png" });
    native.share.mockResolvedValue({});
    expect(canShareImages()).toBe(true);
    expect(await shareImage(card())).toBe("shared");
    expect(native.writeFile).toHaveBeenCalledWith({
      path: "moneylogs-today.png",
      data: btoa(String.fromCharCode(137, 80, 78, 71)),
      directory: "CACHE",
    });
    expect(native.share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ["file:///cache/moneylogs-today.png"] }),
    );
  });

  it("is unavailable in the app when the file can't be written", async () => {
    native.on = true;
    native.writeFile.mockRejectedValue(new Error("disk full"));
    expect(await shareImage(card())).toBe("unavailable");
    expect(native.share).not.toHaveBeenCalled();
  });

  it("shares a file where the browser can", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setWebShare(share);
    setCanShare(() => true);
    expect(canShareImages()).toBe(true);
    expect(await shareImage(card())).toBe("shared");
    const [{ files }] = share.mock.calls[0];
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name).toBe("moneylogs-today.png");
  });

  it("is unavailable where the browser can share links but not files", async () => {
    setWebShare(vi.fn());
    setCanShare(() => false);
    expect(canShareImages()).toBe(false);
    expect(await shareImage(card())).toBe("unavailable");
    setCanShare(undefined);
    expect(canShareImages()).toBe(false);
    expect(await shareImage(card())).toBe("unavailable");
  });

  it("treats a dismissed browser sheet as cancelled", async () => {
    setWebShare(vi.fn().mockRejectedValue(Object.assign(new Error(), { name: "AbortError" })));
    setCanShare(() => true);
    expect(await shareImage(card())).toBe("cancelled");
  });
});
