import * as Sentry from "@sentry/react";
import { ErrorInfo } from "@/types/error";
import { classifyErrorMessage } from "@/utils/errorNoise";

// Uncaught errors and unhandled rejections are captured by Sentry's own global
// handlers (with the original error and stack); this handler only shows the user a
// toast for them. Errors handed over explicitly with reportError() (e.g. by the
// ErrorBoundary, which keeps them from reaching the global handlers) are sent to
// Sentry here. Noise is filtered by utils/errorNoise, same as the Sentry beforeSend.
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
    this.handleError(
      {
        message: error.message,
        stack: error.stack,
        source,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
      error,
    );
  }

  // `reportable` is the error to send to Sentry; omitted for errors Sentry's global
  // handlers already capture.
  private handleError(errorInfo: ErrorInfo, reportable?: Error) {
    const noise = classifyErrorMessage(errorInfo.message ?? "");

    // Pure third-party / benign noise: don't report it and don't toast the user.
    if (noise?.type === "drop") {
      return;
    }

    console.error("Error:", errorInfo);

    // Benign kinds are demoted to "info" by the Sentry beforeSend in main.tsx.
    if (reportable) {
      Sentry.captureException(reportable, { extra: { source: errorInfo.source } });
    }

    this.errorQueue.push(errorInfo);

    // Benign failures (network, IndexedDB aborts) must not surface a scary "An error
    // has occurred" toast for something the user can't act on.
    if (!noise) {
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
