import { ErrorInfo } from '../types/error'

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler
  private errorQueue: ErrorInfo[] = []
  private isInitialized = false

  private constructor() {}

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  initialize(showToast: (message: string) => void) {
    if (this.isInitialized) return

    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.message,
        stack: event.error?.stack,
        source: 'javascript',
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }

      this.handleError(errorInfo, showToast)
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        source: 'promise',
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }

      this.handleError(errorInfo, showToast)
    })

    this.isInitialized = true
  }

  // Public method for manually reporting errors
  reportError(error: Error, source: string = 'manual', showToast: (message: string) => void) {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      source,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    this.handleError(errorInfo, showToast)
  }

  private handleError(errorInfo: ErrorInfo, showToast: (message: string) => void) {
    // Log to console for development
    console.error('Global Error Handler:', {
      ...errorInfo,
      timestamp: errorInfo.timestamp.toISOString()
    })

    // Add to queue for potential batch reporting
    this.errorQueue.push(errorInfo)

    // Show user-friendly notification
    const userMessage = this.getUserFriendlyMessage(errorInfo)
    showToast(userMessage)

    // Optional: Send to external service
    // this.sendToLoggingService(errorInfo)
  }

  private getUserFriendlyMessage(errorInfo: ErrorInfo): string {
    // Customize based on error type or source
    if (errorInfo.source === 'promise' && errorInfo.message.includes('fetch')) {
      return 'Connection issue detected. Please check your internet and try again.'
    }

    if (errorInfo.message.includes('permission')) {
      return 'Permission error. Please refresh the page or contact support.'
    }

    return 'Something unexpected happened. The error has been logged and we\'re looking into it.'
  }

  // Get recent errors for debugging
  getRecentErrors(count: number = 10): ErrorInfo[] {
    return this.errorQueue.slice(-count)
  }

  // Clear error queue
  clearErrors(): void {
    this.errorQueue = []
  }
}

export default GlobalErrorHandler