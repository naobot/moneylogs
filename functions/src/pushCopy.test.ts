import { describe, expect, it } from "vite-plus/test";
import { deadDevices, pushCopy } from "./pushCopy";

describe("pushCopy", () => {
  it("titles posts by their log and says who did what", () => {
    expect(
      pushCopy({
        type: "comment",
        groupName: "Lisbon",
        actorName: "Maya",
        reason: "author",
        excerpt: "worth it!",
      }),
    ).toEqual({ title: "Lisbon", body: "Maya commented on your post: worth it!" });
    expect(
      pushCopy({
        type: "reaction",
        groupName: "Lisbon",
        actorName: "Theo",
        reason: "subscriber",
        emoji: "🔥",
      }),
    ).toEqual({ title: "Lisbon", body: "Theo reacted 🔥 to a post you follow" });
  });

  it("says where a sublog's spending now counts", () => {
    expect(
      pushCopy({ type: "sublog_counted", groupName: "bali 2026", parentTitle: "household" }),
    ).toEqual({
      title: "bali 2026",
      body: "Your spending here now also counts in household, as one line its members can see.",
    });
  });

  it("covers the log timeline", () => {
    expect(pushCopy({ type: "log_ending", groupName: "Lisbon" })?.body).toMatch(/last chance/);
    expect(pushCopy({ type: "log_ended", groupName: "Lisbon" })?.body).toBe("This log has ended.");
  });

  it("covers budgets, total and per category", () => {
    expect(
      pushCopy({
        type: "budget_approaching",
        groupName: "Flat 2B",
        currency: "CAD",
        spent: 820,
        budget: 1000,
      }),
    ).toEqual({ title: "Flat 2B", body: "82% of your CAD budget used (820 CAD of 1,000 CAD)." });
    expect(
      pushCopy({
        type: "budget_exceeded",
        groupName: "Flat 2B",
        categoryName: "Groceries",
        currency: "CAD",
        spent: 410.5,
        budget: 400,
      })?.body,
    ).toBe("Over the Groceries CAD budget (410.5 CAD of 400 CAD).");
    expect(
      pushCopy({ type: "budget_projected", groupName: "Flat 2B", currency: "JPY" })?.body,
    ).toBe("On track to go over your JPY budget this month.");
  });

  it("covers friends, gifts and milestones, titled by the app", () => {
    expect(pushCopy({ type: "friend_request", actorId: "u1", actorName: "Ana" })).toEqual({
      title: "moneylogs",
      body: "Ana wants to be friends",
    });
    expect(pushCopy({ type: "friend_accepted", actorName: "Ana" })?.body).toBe(
      "Ana accepted your friend request",
    );
    expect(pushCopy({ type: "gift_received", actorName: "Ben", findId: "f1" })).toEqual({
      title: "moneylogs",
      body: "Ben sent you a gift. It's waiting, wrapped, in your knick-knack drawer.",
    });
    expect(pushCopy({ type: "milestone_earned", item: "copper_coin", findId: "f2" })).toEqual({
      title: "moneylogs",
      body: "Achievement unlocked: your budget buddy has something for you.",
    });
    expect(pushCopy({ type: "achievement_earned", achievement: "first_gift" })).toEqual({
      title: "moneylogs",
      body: "Achievement unlocked: Gift Giver",
    });
    expect(pushCopy({ type: "achievement_earned", achievement: "from_the_future" })?.body).toBe(
      "Achievement unlocked!",
    );
  });

  it("falls back when a friend's name is missing", () => {
    expect(pushCopy({ type: "friend_request" })?.body).toBe("Someone wants to be friends");
  });

  it("doesn't push notes about your own actions or unknown types", () => {
    expect(pushCopy({ type: "log_created", groupName: "Lisbon" })).toBeNull();
    expect(pushCopy({ type: "log_joined", groupName: "Lisbon" })).toBeNull();
    expect(pushCopy({ type: "something_new" })).toBeNull();
  });

  it("falls back when names are missing", () => {
    expect(pushCopy({ type: "reaction", emoji: "😂" })).toEqual({
      title: "moneylogs",
      body: "Someone reacted 😂 to your post",
    });
  });
});

describe("deadDevices", () => {
  it("drops only devices whose token FCM says is gone for good", () => {
    expect(
      deadDevices(
        ["a", "b", "c", "d"],
        [
          { success: true },
          { success: false, error: { code: "messaging/registration-token-not-registered" } },
          { success: false, error: { code: "messaging/internal-error" } },
          { success: false, error: { code: "messaging/invalid-registration-token" } },
        ],
      ),
    ).toEqual(["b", "d"]);
  });
});
