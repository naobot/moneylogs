import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { copyText } from "../clipboard";

const setClipboard = (clipboard: unknown) =>
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });

afterEach(() => setClipboard(undefined));

describe("copyText", () => {
  it("writes to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("resolves false when the clipboard is missing or refuses", async () => {
    expect(await copyText("hello")).toBe(false);
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) });
    expect(await copyText("hello")).toBe(false);
  });
});
