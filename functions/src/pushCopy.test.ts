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
