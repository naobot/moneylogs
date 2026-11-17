import { describe, it, expect, beforeAll, beforeEach, vi } from "vite-plus/test";

const { captureException, flush, init } = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
  init: vi.fn(),
}));
vi.mock("@sentry/node", () => ({ captureException, flush, init }));

type SentryModule = typeof import("./sentry");
let sentry: SentryModule;
let initCalls: unknown[][] = [];

const httpsError = (code: string) =>
  Object.assign(new Error(code), { code, httpErrorCode: { canonicalName: code, status: 400 } });

beforeAll(async () => {
  // sentry.ts turns itself off under Vitest; switch it on for these tests only.
  vi.stubEnv("VITEST", "");
  vi.stubEnv("FUNCTIONS_EMULATOR", "");
  sentry = await import("./sentry");
  vi.unstubAllEnvs();
  // The suite clears mocks between tests, so keep what the import did.
  initCalls = [...init.mock.calls];
});

beforeEach(() => {
  captureException.mockClear();
  flush.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("Sentry in Cloud Functions", () => {
  it("initialises once, tagged as functions, without tracing", () => {
    expect(initCalls).toHaveLength(1);
    expect(initCalls[0][0]).toMatchObject({
      skipOpenTelemetrySetup: true,
      sendDefaultPii: false,
      initialScope: { tags: { runtime: "functions" } },
    });
  });

  it("passes results through untouched and sends nothing", async () => {
    const fn = sentry.withSentry("ok", async (n: number) => n * 2);
    await expect(fn(21)).resolves.toBe(42);
    expect(captureException).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it("reports an escaping error with the function, uid and params, flushes, and rethrows", async () => {
    const boom = new Error("boom");
    const fn = sentry.withSentryCall("deleteLog", async () => {
      throw boom;
    });
    await expect(fn({ auth: { uid: "u1" }, data: {} } as never)).rejects.toBe(boom);
    expect(captureException).toHaveBeenCalledWith(boom, {
      level: "error",
      tags: { function: "deleteLog" },
      user: { id: "u1" },
      extra: {},
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("doesn't report HttpsErrors that answer the caller", async () => {
    const fn = sentry.withSentryCall("deleteLog", async () => {
      throw httpsError("permission-denied");
    });
    await expect(fn({ auth: { uid: "u1" }, data: {} } as never)).rejects.toThrow();
    expect(captureException).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it("reports caught errors with the invocation's tags, and flushes at the end", async () => {
    const sideFailure = new Error("alerts down");
    const fn = sentry.withSentry("recomputeLedgerMonth", async (_event: { params: object }) => {
      sentry.reportError(sideFailure, {
        action: "budget_alerts",
        level: "warning",
        extra: { month: "2026-11" },
      });
      expect(flush).not.toHaveBeenCalled();
      return "done";
    });
    await expect(fn({ params: { ledgerId: "L1" } })).resolves.toBe("done");
    expect(captureException).toHaveBeenCalledWith(sideFailure, {
      level: "warning",
      tags: { function: "recomputeLedgerMonth", action: "budget_alerts" },
      extra: { params: { ledgerId: "L1" }, month: "2026-11" },
    });
    expect(console.warn).toHaveBeenCalled();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("doesn't report the summary error thrown after an error was already reported", async () => {
    const fn = sentry.withSentryCall("importLedgerEntries", async () => {
      sentry.reportError(new Error("3/10 import writes failed"), { action: "import_writes" });
      throw httpsError("internal");
    });
    await expect(fn({ auth: { uid: "u1" }, data: {} } as never)).rejects.toThrow("internal");
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toMatchObject({ tags: { action: "import_writes" } });
  });

  it("still reports an escaping error after only a warning", async () => {
    const fn = sentry.withSentry("f", async () => {
      sentry.reportError(new Error("minor"), { action: "side", level: "warning" });
      throw new Error("major");
    });
    await expect(fn()).rejects.toThrow("major");
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it("keeps concurrent invocations' tags apart", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = sentry.withSentryCall("slow", async () => {
      await gate;
      sentry.reportError(new Error("late"), { action: "late" });
    });
    const fast = sentry.withSentryCall("fast", async () => {
      sentry.reportError(new Error("early"), { action: "early" });
    });
    const pending = slow({ auth: { uid: "slow-user" }, data: {} } as never);
    await fast({ auth: { uid: "fast-user" }, data: {} } as never);
    release();
    await pending;

    const byAction = Object.fromEntries(
      captureException.mock.calls.map(([, ctx]) => [ctx.tags.action, ctx]),
    );
    expect(byAction.early).toMatchObject({ tags: { function: "fast" }, user: { id: "fast-user" } });
    expect(byAction.late).toMatchObject({ tags: { function: "slow" }, user: { id: "slow-user" } });
  });
});
