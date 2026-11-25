import { describe, it, expect } from "vite-plus/test";
import { planNewUserDoc } from "./ensureUserDocPlan";

describe("planNewUserDoc", () => {
  it("makes the doc registration would have, with the email's local part as the name", () => {
    expect(
      planNewUserDoc("uid1", {
        email: "sam.lee@example.com",
        firebase: { sign_in_provider: "password" },
      }),
    ).toEqual({
      userId: "uid1",
      displayName: "sam.lee",
      email: "sam.lee@example.com",
      groups: [],
      onboardingPending: true,
    });
  });

  it("makes a guest doc for an anonymous sign-in", () => {
    expect(planNewUserDoc("uid2", { firebase: { sign_in_provider: "anonymous" } })).toMatchObject({
      displayName: "guest",
      email: null,
      onboardingPending: true,
    });
  });

  it("falls back to a generic name when the email has no local part", () => {
    expect(planNewUserDoc("uid3", { email: "@example.com" }).displayName).toBe("new user");
  });
});
