import { describe, it, expect } from "vite-plus/test";
import { chunk } from "../chunk";

describe("chunk", () => {
  it("splits into fixed-size parts", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
