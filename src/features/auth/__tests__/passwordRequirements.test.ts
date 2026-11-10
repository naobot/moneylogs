import { describe, it, expect } from "vite-plus/test";
import {
  describePasswordRequirements,
  unmetPasswordRequirements,
} from "@/features/auth/passwordRequirements";

const policy = { customStrengthOptions: { minPasswordLength: 8, maxPasswordLength: 64 } };

describe("unmetPasswordRequirements", () => {
  it("is empty for a valid or unchecked password", () => {
    expect(unmetPasswordRequirements(undefined)).toEqual([]);
    expect(unmetPasswordRequirements({ isValid: true })).toEqual([]);
  });

  it("lists only required-but-unmet rules, using the policy's lengths", () => {
    expect(
      unmetPasswordRequirements({
        isValid: false,
        meetsMinPasswordLength: false,
        containsLowercaseLetter: true,
        containsUppercaseLetter: false,
        containsNumericCharacter: false,
        // undefined = not required by the policy
        containsNonAlphanumericCharacter: undefined,
        passwordPolicy: policy,
      }),
    ).toEqual(["at least 8 characters", "an uppercase letter", "a number"]);
  });

  it("covers the maximum length and symbols", () => {
    expect(
      unmetPasswordRequirements({
        isValid: false,
        meetsMaxPasswordLength: false,
        containsNonAlphanumericCharacter: false,
        passwordPolicy: policy,
      }),
    ).toEqual(["at most 64 characters", "a symbol (e.g. ! or #)"]);
  });

  it("still says something when the policy lengths are unknown", () => {
    expect(unmetPasswordRequirements({ isValid: false, meetsMinPasswordLength: false })).toEqual([
      "more characters",
    ]);
  });
});

describe("describePasswordRequirements", () => {
  it("is null when there's nothing to say", () => {
    expect(describePasswordRequirements(undefined)).toBeNull();
    expect(describePasswordRequirements({ isValid: true })).toBeNull();
  });

  it("reads as a sentence", () => {
    expect(
      describePasswordRequirements({
        isValid: false,
        containsUppercaseLetter: false,
        passwordPolicy: policy,
      }),
    ).toBe("Needs an uppercase letter.");
    expect(
      describePasswordRequirements({
        isValid: false,
        meetsMinPasswordLength: false,
        containsUppercaseLetter: false,
        containsNumericCharacter: false,
        passwordPolicy: policy,
      }),
    ).toBe("Needs at least 8 characters, an uppercase letter and a number.");
  });

  it("falls back to a generic sentence when no rule is identified", () => {
    expect(describePasswordRequirements({ isValid: false })).toBe(
      "Doesn't meet the password requirements.",
    );
  });
});
