import { Component, ErrorInfo, ReactNode } from 'react'
import GlobalErrorHandler from '../utils/errorHandler'

interface Props {
  children: ReactNode
  showToast: (message: string) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorHandler = GlobalErrorHandler.getInstance()

    // Create a combined error message with component stack
    const enhancedError = new Error(
      `${error.message}\n\nComponent Stack: ${errorInfo.componentStack}`
    )

    errorHandler.reportError(enhancedError, 'react-boundary', this.props.showToast)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Oops! Something went wrong</h2>
          <p>
            We've been notified of this issue. Please refresh the page or contact support
            if the problem persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}