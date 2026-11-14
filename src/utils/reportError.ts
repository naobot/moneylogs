import * as Sentry from "@sentry/react";

/** Which part of the app a report comes from; becomes the `feature` tag in Sentry. */
export type Feature =
  | "registration"
  | "onboarding"
  | "default_currency"
  | "personal_ledger"
  | "ledger_tour"
  | "create_log"
  | "ledger_entry"
  | "profile"
  | "log_post"
  | "push";

type ReportContext = {
  feature: Feature;
  /** What was being attempted, snake_case, e.g. "save_welcome_step"; the `action` tag. */
  action: string;
  /** "warning" for failures the user won't notice (e.g. a seen-flag that didn't save). */
  level?: "error" | "warning";
  /** Searchable tags beyond feature/action, e.g. the wizard step. Keep values short. */
  tags?: Record<string, string>;
  /** Free-form context shown on the event. Never put personal data here. */
  extra?: Record<string, unknown>;
};

/** Firebase errors carry a stable `code` ("permission-denied", "auth/network-request-failed"). */
const errorCode = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
};

/**
 * Report an error the app caught and handled (so the global handlers never see it) to
 * Sentry, with the original stack and tags for where it happened. Also logs to the
 * console. Use it in catch blocks instead of a bare console.error.
 */
export const reportError = (
  error: unknown,
  { feature, action, level = "error", tags, extra }: ReportContext,
): void => {
  console.error(`[${feature}] ${action} failed:`, error);
  const code = errorCode(error);
  const exception =
    error instanceof Error
      ? error
      : new Error(
          `${feature}/${action}: ${typeof error === "string" ? error : "non-Error thrown"}`,
        );
  Sentry.captureException(exception, {
    level,
    tags: { feature, action, ...(code ? { error_code: code } : {}), ...tags },
    extra: error instanceof Error ? extra : { ...extra, thrown: error },
  });
};

/**
 * Leave a trail of what the user did (e.g. each welcome step finished), so an error
 * reported later shows the steps that led up to it. Nothing is sent until an error is.
 */
export const trackStep = (
  feature: Feature,
  message: string,
  data?: Record<string, string | number | boolean>,
): void => {
  Sentry.addBreadcrumb({ category: feature, message, data, level: "info" });
};
