interface Toast {
  id: string
  message: string
  timestamp: Date
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className="toast error-toast">
          <div className="toast-content">
            <span className="toast-icon">⚠️</span>
            <span className="toast-message">{toast.message}</span>
          </div>
          <button
            className="toast-close"
            onClick={() => onRemove(toast.id)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}