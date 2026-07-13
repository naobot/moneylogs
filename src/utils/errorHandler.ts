import * as Sentry from "@sentry/react";
import { ErrorInfo } from "@/types/error";

// Third-party / benign noise that is not an app bug and carries no diagnostic
// value: browser-extension content scripts (iOS Safari content blockers,
// password managers, translators) whose runtime.sendMessage fails when the tab
// context is gone ("Invalid call to runtime.sendMessage(). Tab not found."),
// extension context teardown, and the harmless ResizeObserver loop warning.
// These are neither reported to Sentry nor surfaced to the user.
const DROP_PATTERNS = [
  "runtime.sendMessage",
  "Tab not found",
  "Extension context invalidated",
  "ResizeObserver loop",
];

// Client network-layer fetch failures (see the Sentry beforeSend in main.tsx).
// Not app bugs — usually blockers or flaky connections — but we keep reporting
// them (down-ranked in Sentry) for outage trend-spotting. They should not show
// the user a toast, since there's nothing actionable on their end mid-session.
const TOAST_SUPPRESS_PATTERNS = ["Load failed", "Failed to fetch"];

const matchesAny = (message: string, patterns: string[]): boolean =>
  patterns.some((pattern) => message.includes(pattern));

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: ErrorInfo[] = [];
  private isInitialized = false;
  private showToast: ((message?: string) => void) | null = null;

  private constructor() {}

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  initialize(showToast: (message?: string) => void) {
    this.showToast = showToast;
    if (this.isInitialized) return;

    window.addEventListener("error", (event) => {
      this.handleError({
        message: event.message,
        stack: event.error?.stack,
        source: "javascript",
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.handleError({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        source: "promise",
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    });

    this.isInitialized = true;
  }

  reportError(error: Error, source: string = "manual") {
    this.handleError({
      message: error.message,
      stack: error.stack,
      source,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  }

  private handleError(errorInfo: ErrorInfo) {
    const message = errorInfo.message ?? "";

    // Pure third-party / benign noise: don't report it and don't toast the user.
    if (matchesAny(message, DROP_PATTERNS)) {
      return;
    }

    console.error("Error:", errorInfo);

    Sentry.captureException(new Error(errorInfo.message), {
      extra: { source: errorInfo.source, url: errorInfo.url },
    });

    this.errorQueue.push(errorInfo);

    // Network fetch failures are still reported (down-ranked in Sentry) but must
    // not surface a scary "An error has occurred" toast for something the user
    // can't act on. Everything else toasts as before.
    if (!matchesAny(message, TOAST_SUPPRESS_PATTERNS)) {
      this.showToast?.(this.getUserFriendlyMessage(errorInfo));
    }
  }

  private getUserFriendlyMessage(errorInfo: ErrorInfo): string {
    // Extensibility point: return specific messages for anticipated error types
    if (errorInfo.source === "network") return "Connection issue. Please check your internet.";
    return "An error has occurred";
  }

  getRecentErrors(count: number = 10): ErrorInfo[] {
    return this.errorQueue.slice(-count);
  }

  clearErrors(): void {
    this.errorQueue = [];
  }
}

export default GlobalErrorHandler;
