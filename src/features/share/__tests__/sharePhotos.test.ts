import { describe, it, expect } from "vite-plus/test";
import { fitWithin, MAX_PHOTO_EDGE } from "../sharePhotos";

describe("fitWithin", () => {
  it("shrinks a photo so its long edge fits, keeping its shape", () => {
    expect(fitWithin(4032, 3024, MAX_PHOTO_EDGE)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, MAX_PHOTO_EDGE)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(640, 480, MAX_PHOTO_EDGE)).toEqual({ width: 640, height: 480 });
  });

  it("keeps at least a pixel each way", () => {
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});
