import { describe, it, expect } from "vite-plus/test";
import { Timestamp } from "firebase/firestore";
import {
  countUnread,
  describeNotification,
  isNotificationEnabled,
  NOTIFICATION_PREF_DEFAULTS,
  NOTIFICATION_TYPES,
  notificationDetail,
  notificationHref,
  notificationIcon,
  notificationText,
  unreadBadge,
} from "@/utils/notificationTypes";
import { AppNotification } from "@/types/notification";

const NOW = new Date("2026-11-10T12:00:00Z");
const at = (iso: string) => Timestamp.fromDate(new Date(iso));

const base = {
  id: "n1",
  groupId: "g1",
  groupName: "Tokyo Trip",
  createdAt: at("2026-11-10T11:00:00Z"),
  readAt: null,
};

const comment = (reason?: "author" | "subscriber") =>
  ({
    ...base,
    type: "comment",
    postId: "p1",
    commentId: "c1",
    actorId: "u2",
    actorName: "Ben",
    excerpt: "Looks great",
    reason,
  }) as AppNotification;

const budget = (over: Partial<AppNotification> = {}) =>
  ({
    ...base,
    groupId: "l1",
    groupName: "Household",
    logKind: "ledger",
    type: "budget_approaching",
    month: "2026-11",
    currency: "CAD",
    spent: 850,
    budget: 1000,
    ...over,
  }) as AppNotification;

describe("describeNotification", () => {
  it("marks names and log titles as keep-case parts", () => {
    expect(describeNotification(comment("author"), NOW)).toEqual([
      { keep: "Ben" },
      " commented on your post in ",
      { keep: "Tokyo Trip" },
    ]);
  });

  it.each([
    ["author", "Ben commented on your post in Tokyo Trip"],
    ["subscriber", "Ben commented on a post you follow in Tokyo Trip"],
    [undefined, "Ben commented in Tokyo Trip"],
  ] as const)("words a comment by reason %s", (reason, text) => {
    expect(notificationText(comment(reason), NOW)).toBe(text);
  });

  it("words a reaction, defaulting to your post", () => {
    const reaction = {
      ...base,
      type: "reaction",
      postId: "p1",
      actorId: "u2",
      actorName: "Ben",
      emoji: "🎉",
    } as AppNotification;
    expect(notificationText(reaction, NOW)).toBe("Ben reacted 🎉 to your post in Tokyo Trip");
    expect(notificationText({ ...reaction, reason: "subscriber" } as AppNotification, NOW)).toBe(
      "Ben reacted 🎉 to a post you follow in Tokyo Trip",
    );
  });

  it("words starting and joining a log", () => {
    expect(notificationText({ ...base, type: "log_created" } as AppNotification)).toBe(
      "you started Tokyo Trip",
    );
    expect(notificationText({ ...base, type: "log_joined" } as AppNotification)).toBe(
      "you joined Tokyo Trip",
    );
  });

  it("words the log timeline relative to now", () => {
    const ending = { ...base, type: "log_ending", endsAt: at("2026-11-10T20:00:00Z") };
    expect(notificationText(ending as AppNotification, NOW)).toBe(
      "Tokyo Trip ends in 8 hours: last chance to post",
    );
    const ended = {
      ...base,
      type: "log_ended",
      endsAt: at("2026-11-10T10:00:00Z"),
      summaryAt: at("2026-11-11T12:00:00Z"),
    };
    expect(notificationText(ended as AppNotification, NOW)).toBe(
      "Tokyo Trip has ended: summary ready in a day",
    );
    expect(notificationText(ended as AppNotification, new Date("2026-11-12T00:00:00Z"))).toBe(
      "Tokyo Trip has ended: the summary is ready",
    );
  });

  it("words budget alerts for the total and for one category", () => {
    expect(notificationText(budget(), NOW)).toBe("85% of your CAD budget used in Household");
    expect(
      notificationText(budget({ categoryId: "food", categoryName: "Food" } as never), NOW),
    ).toBe("85% of the Food CAD budget used in Household");
    expect(notificationText(budget({ type: "budget_exceeded", spent: 1200 } as never), NOW)).toBe(
      "over your CAD budget in Household",
    );
    expect(
      notificationText(budget({ type: "budget_projected", projected: 1400 } as never), NOW),
    ).toBe("on track to go over your CAD budget in Household this month");
  });

  it("falls back to a generic line for a type this build doesn't know", () => {
    const unknown = { ...base, type: "from_the_future" } as unknown as AppNotification;
    expect(notificationText(unknown)).toBe("something happened in Tokyo Trip");
    expect(notificationHref(unknown)).toBe("/g/g1");
    expect(notificationIcon(unknown)).toBe("notification");
  });
});

describe("notificationDetail", () => {
  it("quotes comment excerpts and states budget amounts", () => {
    expect(notificationDetail(comment())).toBe("Looks great");
    expect(notificationDetail(budget())).toBe("850 CAD of 1,000 CAD");
    expect(notificationDetail(budget({ type: "budget_projected", projected: 1400 } as never))).toBe(
      "about 1,400 CAD by month end, against 1,000 CAD",
    );
  });
});

describe("notificationHref", () => {
  it("links social and ledger logs to their pages", () => {
    expect(notificationHref({ ...base, type: "log_joined" } as AppNotification)).toBe("/g/g1");
    expect(
      notificationHref({ ...base, type: "log_joined", logKind: "ledger" } as AppNotification),
    ).toBe("/l/g1");
  });

  it("links comments and reactions to the post itself", () => {
    expect(notificationHref(comment("author"))).toBe("/g/g1?post=p1&comment=c1");
    const reaction = {
      ...base,
      type: "reaction",
      postId: "p1",
      actorId: "u2",
      actorName: "Ben",
      emoji: "🎉",
    } as AppNotification;
    expect(notificationHref(reaction)).toBe("/g/g1?post=p1");
  });

  it("links budget alerts to that month's stats", () => {
    expect(notificationHref(budget())).toBe("/l/l1/stats?month=2026-11");
  });
});

describe("notification preferences", () => {
  it("has a default for every type, plus category budgets off by default", () => {
    for (const type of Object.keys(NOTIFICATION_TYPES)) {
      expect(NOTIFICATION_PREF_DEFAULTS).toHaveProperty(type);
    }
    expect(NOTIFICATION_PREF_DEFAULTS.budget_category).toBe(false);
    expect(NOTIFICATION_PREF_DEFAULTS.budget_exceeded).toBe(true);
  });

  it("uses the user's choice when set, the default otherwise", () => {
    expect(isNotificationEnabled(undefined, "comment")).toBe(true);
    expect(isNotificationEnabled({ comment: false }, "comment")).toBe(false);
    expect(isNotificationEnabled({ budget_category: true }, "budget_category")).toBe(true);
    expect(isNotificationEnabled({}, "budget_category")).toBe(false);
  });
});

describe("unread badge", () => {
  it("counts notifications without readAt", () => {
    expect(
      countUnread([{ readAt: null }, { readAt: at("2026-11-10T00:00:00Z") }, { readAt: null }]),
    ).toBe(2);
  });

  it("shows nothing, then 1–9, then 9+", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(9)).toBe("9");
    expect(unreadBadge(10)).toBe("9+");
    expect(unreadBadge(20)).toBe("9+");
  });
});
