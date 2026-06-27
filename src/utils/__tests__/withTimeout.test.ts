import { describe, it, expect, vi } from "vite-plus/test";
import { withTimeout } from "@/hooks/useImageUpload";

vi.mock("@/config/firebase-config", () => ({
  storage: {},
}));

describe("withTimeout", () => {
  it("resolves when the promise resolves before the timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("rejects with 'Upload timed out' when the promise exceeds the deadline", async () => {
    vi.useFakeTimers();
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 500));
    const race = withTimeout(slow, 100);
    vi.advanceTimersByTime(200);
    await expect(race).rejects.toThrow("Upload timed out");
    vi.useRealTimers();
  });

  it("propagates the original rejection when the promise rejects before the timeout", async () => {
    await expect(withTimeout(Promise.reject(new Error("network error")), 1000)).rejects.toThrow(
      "network error",
    );
  });
});
