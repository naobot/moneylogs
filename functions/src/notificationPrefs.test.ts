import { describe, it, expect } from "vite-plus/test";
import {
  EMAIL_PREF_DEFAULTS,
  isEmailEnabled,
  isNotificationEnabled,
  NEVER_EMAILED,
  NOTIFICATION_PREF_DEFAULTS,
} from "./notificationPrefs";
import {
  EMAIL_PREF_DEFAULTS as CLIENT_EMAIL_DEFAULTS,
  isEmailable,
  NOTIFICATION_PREF_DEFAULTS as CLIENT_DEFAULTS,
  NOTIFICATION_TYPES,
} from "../../src/utils/notificationTypes";
import { NotificationType } from "../../src/types/notification";

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

  it("has the same email defaults and never-emailed types as the client", () => {
    expect(EMAIL_PREF_DEFAULTS).toEqual(CLIENT_EMAIL_DEFAULTS);
    const clientNever = (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).filter(
      (type) => !isEmailable(type),
    );
    expect([...NEVER_EMAILED].sort()).toEqual(clientNever.sort());
  });

  it("emails a type only when it's on in-app, on for email, and email isn't paused", () => {
    expect(isEmailEnabled(undefined, "log_ending")).toBe(true);
    expect(isEmailEnabled(undefined, "comment")).toBe(false);
    expect(isEmailEnabled({ emailPrefs: { comment: true } }, "comment")).toBe(true);
    expect(isEmailEnabled({ emailPrefs: { log_ending: false } }, "log_ending")).toBe(false);
    expect(isEmailEnabled({ emailPaused: true }, "log_ending")).toBe(false);
    expect(isEmailEnabled({ notificationPrefs: { log_ending: false } }, "log_ending")).toBe(false);
  });

  it("never emails the user's own actions or unknown types", () => {
    expect(isEmailEnabled({ emailPrefs: { log_created: true } }, "log_created")).toBe(false);
    expect(isEmailEnabled({ emailPrefs: { log_joined: true } }, "log_joined")).toBe(false);
    expect(isEmailEnabled(undefined, "something_new")).toBe(false);
    expect(isEmailEnabled(undefined, undefined)).toBe(false);
  });
});
