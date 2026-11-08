import { describe, it, expect } from "vite-plus/test";
import { confirmsDeletion, creatorUid } from "@/utils/logOwnership";

describe("creatorUid", () => {
  it("uses createdBy, falling back to the first member for ledgers only", () => {
    expect(creatorUid({ createdBy: "u1" }, "social")).toBe("u1");
    expect(creatorUid({}, "social")).toBeUndefined();
    expect(creatorUid({ memberUids: ["u2", "u3"] }, "financial")).toBe("u2");
    expect(creatorUid({ createdBy: "u1", memberUids: ["u2"] }, "financial")).toBe("u1");
  });
});

describe("confirmsDeletion", () => {
  it("needs the title, ignoring case and surrounding spaces", () => {
    expect(confirmsDeletion("  tokyo trip ", "Tokyo Trip")).toBe(true);
    expect(confirmsDeletion("Tokyo", "Tokyo Trip")).toBe(false);
    expect(confirmsDeletion("", "")).toBe(false);
  });
});
