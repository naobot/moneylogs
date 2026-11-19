import { describe, it, expect } from "vite-plus/test";
import { classifyErrorMessage } from "@/utils/errorNoise";

describe("classifyErrorMessage", () => {
  it("drops browser-extension and ResizeObserver noise", () => {
    expect(classifyErrorMessage("Invalid call to runtime.sendMessage(). Tab not found.")).toEqual({
      type: "drop",
    });
    expect(classifyErrorMessage("ResizeObserver loop limit exceeded")).toEqual({ type: "drop" });
  });

  it("marks network fetch failures as benign", () => {
    expect(classifyErrorMessage("TypeError: Failed to fetch")).toEqual({
      type: "benign",
      kind: "network-fetch-failure",
    });
    expect(classifyErrorMessage("Load failed")).toEqual({
      type: "benign",
      kind: "network-fetch-failure",
    });
  });

  it("marks Chromium IndexedDB transaction aborts as benign", () => {
    expect(classifyErrorMessage("AbortError: Uncaught exception in event handler.")).toEqual({
      type: "benign",
      kind: "indexeddb-abort",
    });
  });

  it("leaves everything else as a real error", () => {
    expect(classifyErrorMessage("Cannot read properties of undefined")).toBeNull();
    expect(classifyErrorMessage("")).toBeNull();
  });
});
