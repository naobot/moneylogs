import "./Snackbar.scss";

interface Toast {
  id: string;
  message: string;
  timestamp: Date;
}

interface SnackbarProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const Snackbar = ({ toasts, onRemove }: SnackbarProps) => {
  if (toasts.length === 0) return null;
  const toast = toasts[toasts.length - 1];

  return (
    <div className="Snackbar">
      <div key={toast.id} className="Snackbar__item">
        <span className="Snackbar__message">{toast.message}</span>
        <button className="Snackbar__close" onClick={() => onRemove(toast.id)} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
};
