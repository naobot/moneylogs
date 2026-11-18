import { describe, it, expect } from "vite-plus/test";
import {
  channelOf,
  channelPatch,
  channelsFor,
  emailedTypeCount,
  NOTIFICATION_SETTING_GROUPS,
  notificationsSummary,
} from "../notificationSettings";
import { NOTIFICATION_PREF_DEFAULTS } from "@/utils/notificationTypes";

describe("notification settings", () => {
  it("lists every preference key exactly once", () => {
    const keys = NOTIFICATION_SETTING_GROUPS.flatMap((g) => g.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(NOTIFICATION_PREF_DEFAULTS).sort());
  });

  it("offers email only for types the user didn't cause", () => {
    expect(channelsFor("comment")).toEqual(["email", "inbox", "off"]);
    expect(channelsFor("log_created")).toEqual(["inbox", "off"]);
    expect(channelsFor("budget_category")).toEqual(["inbox", "off"]);
  });

  it("reads each row from the prefs, falling back to defaults", () => {
    expect(channelOf(undefined, "log_ending")).toBe("email");
    expect(channelOf(undefined, "comment")).toBe("inbox");
    expect(channelOf(undefined, "budget_category")).toBe("off");
    expect(channelOf({ emailPrefs: { comment: true } }, "comment")).toBe("email");
    expect(channelOf({ notificationPrefs: { log_ending: false } }, "log_ending")).toBe("off");
    // Pausing email has its own switch; the rows keep showing the chosen channel.
    expect(channelOf({ emailPaused: true }, "log_ending")).toBe("email");
  });

  it("writes one dotted key per pref", () => {
    expect(channelPatch("comment", "email")).toEqual({
      "notificationPrefs.comment": true,
      "emailPrefs.comment": true,
    });
    expect(channelPatch("log_ending", "inbox")).toEqual({
      "notificationPrefs.log_ending": true,
      "emailPrefs.log_ending": false,
    });
    expect(channelPatch("comment", "off")).toEqual({ "notificationPrefs.comment": false });
    expect(channelPatch("log_joined", "inbox")).toEqual({ "notificationPrefs.log_joined": true });
  });

  it("summarises the drawer", () => {
    expect(emailedTypeCount(undefined)).toBe(5);
    expect(notificationsSummary(undefined)).toBe("daily email · 5 types");
    expect(notificationsSummary({ emailPaused: true })).toBe("email paused");
    expect(
      notificationsSummary({
        emailPrefs: {
          log_ending: false,
          log_ended: false,
          budget_exceeded: false,
          log_invite: false,
        },
      }),
    ).toBe("daily email · 1 type");
    expect(
      notificationsSummary({
        emailPrefs: {
          log_ending: false,
          log_ended: false,
          budget_exceeded: false,
          friend_request: false,
          log_invite: false,
        },
      }),
    ).toBe("inbox only");
  });
});
