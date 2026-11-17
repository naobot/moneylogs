import { describe, it, expect } from "vite-plus/test";
import {
  DIGEST_LINES,
  DIGEST_MAX_ITEMS,
  DigestNotification,
  digestLine,
  escapeHtml,
  nextDigestAt,
  renderDigest,
  selectDigestItems,
} from "./digest";
import { NOTIFICATION_TYPES } from "../../../src/utils/notificationTypes";

const ms = (iso: string) => new Date(iso).getTime();

const item = (over: Partial<DigestNotification> = {}): DigestNotification => ({
  id: "n1",
  type: "log_ending",
  createdAtMs: ms("2026-11-17T10:00:00Z"),
  read: false,
  groupId: "g1",
  groupName: "Tokyo Trip",
  ...over,
});

describe("nextDigestAt", () => {
  it("is 19:00 tonight in the user's zone when that's still ahead", () => {
    // 10:00 in Toronto (UTC-5) → 19:00 Toronto = 00:00 UTC next day.
    expect(nextDigestAt(ms("2026-11-17T15:00:00Z"), "America/Toronto")).toBe(
      ms("2026-11-18T00:00:00Z"),
    );
  });

  it("is tomorrow's 19:00 once tonight's has passed", () => {
    expect(nextDigestAt(ms("2026-11-17T20:00:00Z"), "UTC")).toBe(ms("2026-11-18T19:00:00Z"));
    expect(nextDigestAt(ms("2026-11-17T19:00:00Z"), "UTC")).toBe(ms("2026-11-18T19:00:00Z"));
  });

  it("follows daylight saving changes", () => {
    // Toronto springs forward on 2026-03-08: 19:00 is UTC-4 that evening.
    expect(nextDigestAt(ms("2026-03-08T12:00:00Z"), "America/Toronto")).toBe(
      ms("2026-03-08T23:00:00Z"),
    );
  });

  it("uses UTC for a missing or unknown zone", () => {
    expect(nextDigestAt(ms("2026-11-17T08:00:00Z"))).toBe(ms("2026-11-17T19:00:00Z"));
    expect(nextDigestAt(ms("2026-11-17T08:00:00Z"), "Not/AZone")).toBe(ms("2026-11-17T19:00:00Z"));
  });
});

describe("selectDigestItems", () => {
  const since = ms("2026-11-17T00:00:00Z");

  it("keeps unread, email-enabled notifications since the last digest, oldest first", () => {
    const items = [
      item({ id: "late", createdAtMs: ms("2026-11-17T12:00:00Z") }),
      item({ id: "early", createdAtMs: ms("2026-11-17T09:00:00Z") }),
      item({ id: "read", read: true }),
      item({ id: "old", createdAtMs: ms("2026-11-16T09:00:00Z") }),
      item({ id: "comment", type: "comment" }), // email off by default
      item({ id: "mine", type: "log_created" }), // never emailed
    ];
    expect(selectDigestItems(items, {}, since).map((n) => n.id)).toEqual(["early", "late"]);
  });

  it("follows the user's email prefs and the pause switch", () => {
    const items = [item({ id: "c", type: "comment" }), item({ id: "e" })];
    expect(
      selectDigestItems(items, { emailPrefs: { comment: true, log_ending: false } }, since).map(
        (n) => n.id,
      ),
    ).toEqual(["c"]);
    expect(selectDigestItems(items, { emailPaused: true }, since)).toEqual([]);
  });

  it("needs budget_category for per-category budget alerts", () => {
    const alert = item({ type: "budget_exceeded", categoryName: "Food" });
    expect(selectDigestItems([alert], {}, since)).toEqual([]);
    expect(
      selectDigestItems([alert], { notificationPrefs: { budget_category: true } }, since),
    ).toHaveLength(1);
  });

  it("caps the digest", () => {
    const many = Array.from({ length: DIGEST_MAX_ITEMS + 5 }, (_, i) => item({ id: `n${i}` }));
    expect(selectDigestItems(many, {}, since)).toHaveLength(DIGEST_MAX_ITEMS);
  });
});

describe("digest copy", () => {
  it("has a line for every notification type", () => {
    expect(Object.keys(DIGEST_LINES).sort()).toEqual(Object.keys(NOTIFICATION_TYPES).sort());
  });

  it("links to the same places as the inbox", () => {
    expect(
      digestLine(
        item({ type: "comment", actorName: "Ben", postId: "p1", commentId: "c1", excerpt: "hi" }),
      ),
    ).toEqual({
      text: "Ben commented on your post in Tokyo Trip",
      detail: "hi",
      href: "/g/g1?post=p1&comment=c1",
    });
    expect(digestLine(item({ logKind: "ledger" })).href).toBe("/l/g1");
    expect(
      digestLine(
        item({
          type: "budget_exceeded",
          month: "2026-11",
          currency: "CAD",
          spent: 1200,
          budget: 1000,
        }),
      ),
    ).toEqual({
      text: "over your CAD budget in Tokyo Trip",
      detail: "CA$1,200.00 of CA$1,000.00",
      href: "/l/g1/stats?month=2026-11",
    });
    expect(digestLine(item({ type: "brand_new" })).text).toBe("something happened in Tokyo Trip");
  });
});

describe("renderDigest", () => {
  const render = (over: Partial<Parameters<typeof renderDigest>[0]> = {}) =>
    renderDigest({ items: [item()], appUrl: "https://app.test/", displayName: "Nao", ...over });

  it("counts the notifications in the subject", () => {
    expect(render().subject).toBe("moneylogs: 1 new notification");
    expect(render({ items: [item(), item({ id: "n2" })] }).subject).toBe(
      "moneylogs: 2 new notifications",
    );
  });

  it("links every line into the app, plus the settings drawer", () => {
    const { text, html } = render();
    expect(text).toContain("https://app.test/g/g1");
    expect(text).toContain("https://app.test/me#notifications");
    expect(html).toContain('href="https://app.test/g/g1"');
    expect(text).not.toContain("unsubscribe");
  });

  it("adds the unsubscribe link when given one", () => {
    const { text, html } = render({ unsubscribeUrl: "https://fn.test/u?x=1&y=2" });
    expect(text).toContain("unsubscribe from all email: https://fn.test/u?x=1&y=2");
    expect(html).toContain('href="https://fn.test/u?x=1&amp;y=2"');
  });

  it("escapes user content in the html", () => {
    const { html } = render({
      items: [item({ groupName: "<script>alert(1)</script>" })],
      displayName: 'A "B"',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &quot;B&quot;");
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
