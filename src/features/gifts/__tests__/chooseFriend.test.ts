import { describe, it, expect } from "vite-plus/test";
import { chooseFriend } from "../chooseFriend";

describe("chooseFriend", () => {
  const friends = ["ana", "bo", "cy"];

  it("preselects the friend from their profile, not the first one", () => {
    expect(chooseFriend("", "cy", friends)).toBe("cy");
  });

  it("holds the preselection once the friends list loads", () => {
    expect(chooseFriend("", "cy", [])).toBe("");
    expect(chooseFriend("", "cy", friends)).toBe("cy");
  });

  it("lets a pick in the dropdown override the preselection", () => {
    expect(chooseFriend("bo", "cy", friends)).toBe("bo");
  });

  it("falls back to the first friend for someone who isn't a friend", () => {
    expect(chooseFriend("", "stranger", friends)).toBe("ana");
    expect(chooseFriend("", undefined, friends)).toBe("ana");
  });
});
