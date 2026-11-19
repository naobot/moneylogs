import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/react";
import GlobalErrorHandler from "@/utils/errorHandler";

// The handler is a singleton; reportError() runs the same handleError path that
// the global error / unhandledrejection listeners feed into, plus a Sentry report.
describe("GlobalErrorHandler noise filtering", () => {
  const handler = GlobalErrorHandler.getInstance();
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    handler.initialize(showToast);
  });

  it("drops browser-extension noise entirely — no Sentry report, no toast", () => {
    handler.reportError(new Error("Invalid call to runtime.sendMessage(). Tab not found."));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("drops the benign ResizeObserver loop warning", () => {
    handler.reportError(new Error("ResizeObserver loop completed with undelivered notifications."));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("reports network fetch failures to Sentry but suppresses the user toast", () => {
    handler.reportError(new Error("Load failed"));

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("reports IndexedDB transaction aborts but suppresses the user toast", () => {
    handler.reportError(new Error("Uncaught exception in event handler."));

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("reports and toasts ordinary app errors, passing the original error", () => {
    const error = new Error("Something genuinely broke");
    handler.reportError(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.anything());
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});

// Sentry's own global handlers capture uncaught errors and unhandled rejections, so
// the listeners only decide on the toast; reporting again would double every event.
describe("GlobalErrorHandler global listeners", () => {
  const handler = GlobalErrorHandler.getInstance();
  const showToast = vi.fn();

  const rejectUnhandled = (reason: unknown) => {
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: reason });
    window.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    handler.initialize(showToast);
  });

  it("toasts an unhandled rejection without reporting it to Sentry again", () => {
    rejectUnhandled(new Error("Something genuinely broke"));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("doesn't toast an unhandled IndexedDB abort", () => {
    rejectUnhandled(new DOMException("Uncaught exception in event handler.", "AbortError"));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
