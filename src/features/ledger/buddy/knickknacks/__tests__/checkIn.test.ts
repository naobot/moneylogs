import { describe, it, expect, beforeEach, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  call: vi.fn(() => Promise.resolve({ data: { ok: true, more: true } })),
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => state.call }));
vi.mock("@/config/firebase-config", () => ({ functions: {} }));
vi.mock("@/utils/reportError", () => ({ reportError: vi.fn() }));

import { EVENING_FROM_HOUR, nextAsk, requestDailyCheckIn, shouldAsk } from "../checkIn";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("daily check-in scheduling", () => {
  it("asks on a new day, or once the hour it was told to wait for comes", () => {
    expect(shouldAsk(null, "2026-11-18", 9)).toBe(true);
    expect(shouldAsk({ day: "2026-11-17", hour: 24 }, "2026-11-18", 9)).toBe(true);
    expect(shouldAsk({ day: "2026-11-18", hour: 17 }, "2026-11-18", 16)).toBe(false);
    expect(shouldAsk({ day: "2026-11-18", hour: 17 }, "2026-11-18", 17)).toBe(true);
    expect(shouldAsk({ day: "2026-11-18", hour: 24 }, "2026-11-18", 23)).toBe(false);
  });

  it("waits for the evening, then hourly, then until tomorrow", () => {
    expect(nextAsk({ more: true, today: "2026-11-18", hour: 9 })).toEqual({
      day: "2026-11-18",
      hour: EVENING_FROM_HOUR,
    });
    expect(nextAsk({ more: true, today: "2026-11-18", hour: 19 })).toEqual({
      day: "2026-11-18",
      hour: 20,
    });
    expect(nextAsk({ more: false, today: "2026-11-18", hour: 9 })).toEqual({
      day: "2026-11-18",
      hour: 24,
    });
  });

  describe("requestDailyCheckIn", () => {
    beforeEach(() => {
      window.localStorage.clear();
      state.call.mockClear();
    });

    it("asks once in the morning, then not again until the evening", async () => {
      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-18", hour: 9 });
      await flush();
      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-18", hour: 12 });
      await flush();
      expect(state.call).toHaveBeenCalledTimes(1);
      // The web says so: only Android check-ins count towards the closed test.
      expect(state.call).toHaveBeenCalledWith({ platform: "web" });

      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-18", hour: 18 });
      await flush();
      expect(state.call).toHaveBeenCalledTimes(2);
    });

    it("stops for the day once the server says nothing's left", async () => {
      state.call.mockImplementationOnce(() => Promise.resolve({ data: { ok: true, more: false } }));
      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-18", hour: 19 });
      await flush();
      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-18", hour: 23 });
      await flush();
      expect(state.call).toHaveBeenCalledTimes(1);
      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-19", hour: 8 });
      await flush();
      expect(state.call).toHaveBeenCalledTimes(2);
    });

    it("doesn't ask twice at once", async () => {
      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-18", hour: 9 });
      requestDailyCheckIn({ userDocId: "u1", today: "2026-11-18", hour: 9 });
      await flush();
      expect(state.call).toHaveBeenCalledTimes(1);
    });
  });
});
