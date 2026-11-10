import { describe, it, expect } from "vite-plus/test";
import { isNotificationEnabled, NOTIFICATION_PREF_DEFAULTS } from "./notificationPrefs";
import { NOTIFICATION_PREF_DEFAULTS as CLIENT_DEFAULTS } from "../../src/utils/notificationTypes";

describe("notification preferences (functions)", () => {
  it("has the same defaults as the client registry", () => {
    expect(NOTIFICATION_PREF_DEFAULTS).toEqual(CLIENT_DEFAULTS);
  });

  it("uses a boolean preference when set, the default otherwise", () => {
    expect(isNotificationEnabled(undefined, "comment")).toBe(true);
    expect(isNotificationEnabled({ notificationPrefs: { comment: false } }, "comment")).toBe(false);
    expect(isNotificationEnabled({ notificationPrefs: { comment: "no" } }, "comment")).toBe(true);
    expect(isNotificationEnabled({ notificationPrefs: null }, "budget_category")).toBe(false);
  });
});
