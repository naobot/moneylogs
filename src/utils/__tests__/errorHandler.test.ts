import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/react";
import GlobalErrorHandler from "@/utils/errorHandler";

// The handler is a singleton; reportError() runs the same handleError path that
// the global error / unhandledrejection listeners feed into.
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

  it("reports and toasts ordinary app errors", () => {
    handler.reportError(new Error("Something genuinely broke"));

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
