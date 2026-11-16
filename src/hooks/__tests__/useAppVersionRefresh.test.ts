import { describe, it, expect } from "vite-plus/test";
import {
  AWAY_MS as AWAY,
  decideReturnAction,
  isEditableElement,
  shouldPromptUpdate,
} from "@/hooks/useAppVersionRefresh";

describe("shouldPromptUpdate", () => {
  it("is false when the running build id is unknown", () => {
    expect(shouldPromptUpdate({ bootBuildId: null, fetchedBuildId: "abc", hiddenMs: AWAY })).toBe(
      false,
    );
  });

  it("is false when the fetched build id is unknown", () => {
    expect(shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: null, hiddenMs: AWAY })).toBe(
      false,
    );
  });

  it("is false when the build is unchanged", () => {
    expect(shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "abc", hiddenMs: AWAY })).toBe(
      false,
    );
  });

  it("is false when a newer build exists but the tab wasn't away long enough", () => {
    expect(
      shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: AWAY - 1 }),
    ).toBe(false);
  });

  it("is true when a newer build exists and the tab was away past the threshold", () => {
    expect(shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: AWAY })).toBe(
      true,
    );
  });

  it("respects a custom awayMs threshold", () => {
    expect(
      shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: 60, awayMs: 100 }),
    ).toBe(false);
    expect(
      shouldPromptUpdate({ bootBuildId: "abc", fetchedBuildId: "def", hiddenMs: 100, awayMs: 100 }),
    ).toBe(true);
  });
});

describe("decideReturnAction", () => {
  it("does nothing when the tab wasn't away long enough", () => {
    expect(decideReturnAction({ hiddenMs: AWAY - 1, isEditing: false })).toBe("none");
    expect(decideReturnAction({ hiddenMs: AWAY - 1, isEditing: true })).toBe("none");
  });

  it("reloads after the threshold when nothing is being edited", () => {
    expect(decideReturnAction({ hiddenMs: AWAY, isEditing: false })).toBe("reload");
  });

  it("only checks for a new build after the threshold when mid-edit", () => {
    expect(decideReturnAction({ hiddenMs: AWAY, isEditing: true })).toBe("check");
  });

  it("uses a three hour default threshold", () => {
    expect(AWAY).toBe(3 * 60 * 60 * 1000);
  });
});

describe("isEditableElement", () => {
  const input = (type: string) => Object.assign(document.createElement("input"), { type });

  it("is false for nothing or non-editable elements", () => {
    expect(isEditableElement(null)).toBe(false);
    expect(isEditableElement(document.body)).toBe(false);
    expect(isEditableElement(document.createElement("button"))).toBe(false);
  });

  it("is true for text-like inputs and textareas", () => {
    expect(isEditableElement(input("text"))).toBe(true);
    expect(isEditableElement(input("number"))).toBe(true);
    expect(isEditableElement(document.createElement("textarea"))).toBe(true);
  });

  it("is false for non-text inputs and read-only or disabled fields", () => {
    expect(isEditableElement(input("checkbox"))).toBe(false);
    expect(isEditableElement(input("submit"))).toBe(false);
    expect(isEditableElement(Object.assign(input("text"), { readOnly: true }))).toBe(false);
    expect(
      isEditableElement(Object.assign(document.createElement("textarea"), { disabled: true })),
    ).toBe(false);
  });

  it("is true for contenteditable elements", () => {
    const div = document.createElement("div");
    // jsdom doesn't compute isContentEditable, so stand in for the browser.
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isEditableElement(div)).toBe(true);
  });
});
