import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

const { captureException, addBreadcrumb } = vi.hoisted(() => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
vi.mock("@sentry/react", () => ({ captureException, addBreadcrumb }));

import { reportError, trackStep } from "@/utils/reportError";

describe("reportError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends the original error, tagged with where it happened", () => {
    const err = new Error("boom");
    reportError(err, {
      feature: "onboarding",
      action: "save_welcome_step",
      tags: { step: "name" },
    });
    expect(captureException).toHaveBeenCalledWith(err, {
      level: "error",
      tags: { feature: "onboarding", action: "save_welcome_step", step: "name" },
      extra: undefined,
    });
  });

  it("tags Firebase error codes so they can be searched", () => {
    const err = Object.assign(new Error("denied"), { code: "permission-denied" });
    reportError(err, { feature: "ledger_tour", action: "record_tour", level: "warning" });
    expect(captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ error_code: "permission-denied" }),
      }),
    );
  });

  it("wraps non-Error throws so they still get a stack, keeping what was thrown", () => {
    reportError({ weird: true }, { feature: "profile", action: "update_profile" });
    const [exception, context] = captureException.mock.calls[0];
    expect(exception).toBeInstanceOf(Error);
    expect((exception as Error).message).toBe("profile/update_profile: non-Error thrown");
    expect(context.extra).toEqual({ thrown: { weird: true } });
  });

  it("still logs to the console", () => {
    reportError(new Error("x"), { feature: "create_log", action: "create_log" });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("trackStep", () => {
  it("leaves a breadcrumb under the feature", () => {
    trackStep("onboarding", "finished step", { step: "name" });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "onboarding",
      message: "finished step",
      data: { step: "name" },
      level: "info",
    });
  });
});
