import { describe, it, expect } from "vite-plus/test";

import { CHEERS, cheerText } from "../cheers";

const [rules] = Object.values(
  import.meta.glob<string>("/firestore.rules", { query: "?raw", import: "default", eager: true }),
);

/** The cheer keys the nudges rule accepts: the list after `d.cheer in [`. */
const ruleKeys = (): string[] => {
  const list = /d\.cheer in \[([^\]]*)\]/.exec(rules)?.[1] ?? "";
  return [...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
};

describe("cheers", () => {
  it("have unique keys and lowercase words", () => {
    const keys = CHEERS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CHEERS) expect(c.text).toBe(c.text.toLowerCase());
  });

  it("are exactly the keys firestore.rules accepts", () => {
    expect(ruleKeys().sort()).toEqual(CHEERS.map((c) => c.key).sort());
  });

  it("look up their words, and nothing for unknown or retired keys", () => {
    expect(cheerText("got_this")).toBe("you've got this");
    expect(cheerText("nope")).toBeNull();
    expect(cheerText(null)).toBeNull();
  });
});
