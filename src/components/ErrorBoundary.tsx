import { Component, ErrorInfo, ReactNode } from "react";
import GlobalErrorHandler from "../utils/errorHandler";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    GlobalErrorHandler.getInstance().reportError(error, "react-boundary");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ErrorBoundary">
          <p>Something went wrong. Please refresh the page.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}
