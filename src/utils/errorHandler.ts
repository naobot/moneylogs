import * as Sentry from "@sentry/react";
import { ErrorInfo } from "../types/error";

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
    console.error("Error:", errorInfo);

    Sentry.captureException(new Error(errorInfo.message), {
      extra: { source: errorInfo.source, url: errorInfo.url },
    });

    this.errorQueue.push(errorInfo);
    this.showToast?.(this.getUserFriendlyMessage(errorInfo));
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
