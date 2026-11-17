import { AsyncLocalStorage } from "node:async_hooks";
import * as Sentry from "@sentry/node";
import type { CallableRequest } from "firebase-functions/v2/https";
import { InvocationContext, invocationContext, shouldReport } from "./sentryPlan";

/**
 * Sentry for Cloud Functions. Events go to the same project as the web app (the DSN is
 * public; it's in the web bundle too), tagged `runtime: functions` so they can be told apart.
 * Off in the emulator and under tests.
 */
const DSN =
  "https://0e984f575ce18cc4c1dc79cfa56e845e@o4511585490239488.ingest.us.sentry.io/4511585495744512";

const enabled = process.env.FUNCTIONS_EMULATOR !== "true" && !process.env.VITEST;

if (enabled) {
  Sentry.init({
    dsn: DSN,
    // Errors only: no tracing, so skip the OpenTelemetry setup and its cold-start cost.
    skipOpenTelemetrySetup: true,
    sendDefaultPii: false,
    initialScope: { tags: { runtime: "functions" } },
  });
}

/**
 * The current invocation, kept per async call chain rather than on Sentry's global scope:
 * one v2 instance serves many requests at once, and their tags mustn't mix.
 */
type InvocationState = InvocationContext & {
  /** Something was captured, so flush before the invocation ends. */
  sent: boolean;
  /** An error-level report was made; see withSentry. */
  reportedError: boolean;
};
const invocation = new AsyncLocalStorage<InvocationState>();

/** Sentry can't send once the response is out (the CPU is throttled), so wait for it. */
const FLUSH_MS = 2000;

type CaptureContext = {
  action?: string;
  level?: "error" | "warning";
  extra?: Record<string, unknown>;
};

const capture = (error: unknown, { action, level = "error", extra }: CaptureContext) => {
  const ctx = invocation.getStore();
  if (ctx && level === "error") ctx.reportedError = true;
  if (!enabled) return;
  if (ctx) ctx.sent = true;
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    level,
    tags: {
      ...(ctx ? { function: ctx.fn } : {}),
      ...(action ? { action } : {}),
    },
    ...(ctx?.uid ? { user: { id: ctx.uid } } : {}),
    extra: { ...(ctx?.params ? { params: ctx.params } : {}), ...extra },
  });
};

/**
 * Report an error a function caught and handled (so withSentry never sees it). Also logs it
 * to Cloud Logging. Use it in catch blocks instead of a bare console.error.
 */
export const reportError = (
  error: unknown,
  context: {
    /** What was being attempted, snake_case, e.g. "budget_alerts"; the `action` tag. */
    action: string;
    /** "warning" for best-effort side work that failed without affecting the result. */
    level?: "error" | "warning";
    /** Ids and counts only, never personal data. */
    extra?: Record<string, unknown>;
  },
): void => {
  const log = context.level === "warning" ? console.warn : console.error;
  log(`${invocation.getStore()?.fn ?? "function"}: ${context.action} failed:`, error);
  capture(error, context);
};

/**
 * Wrap a function's handler so an error escaping it reaches Sentry (tagged with the
 * function's name and the caller's uid or trigger params) before being rethrown as usual.
 * Expected HttpsErrors (invalid input, permission denied...) aren't reported, nor is an
 * error thrown after the handler already reported one: that's the user-facing summary of a
 * failure Sentry has already seen with its real stack and context.
 *
 *   export const deleteLog = onCall(opts, withSentry("deleteLog", async (request) => { ... }));
 */
export const withSentry =
  <A extends unknown[], R>(fn: string, handler: (...args: A) => R | Promise<R>) =>
  (...args: A): Promise<R> =>
    invocation.run(
      { ...invocationContext(fn, args[0]), sent: false, reportedError: false },
      async () => {
        try {
          return await handler(...args);
        } catch (error) {
          if (shouldReport(error) && !invocation.getStore()?.reportedError) capture(error, {});
          throw error;
        } finally {
          if (invocation.getStore()?.sent) await Sentry.flush(FLUSH_MS);
        }
      },
    );

/**
 * withSentry for onCall handlers. onCall is overloaded, which stops TypeScript inferring
 * the request type through the generic wrapper; this pins it.
 */
export const withSentryCall = <R>(
  fn: string,
  handler: (request: CallableRequest) => R | Promise<R>,
): ((request: CallableRequest) => Promise<R>) => withSentry(fn, handler);
