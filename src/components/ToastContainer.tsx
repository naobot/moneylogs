import cx from "classnames";

import "./Snackbar.scss";

interface Toast {
  id: string;
  message: string;
  variant: "error" | "success";
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
      <div
        key={toast.id}
        className={cx("Snackbar__item", {
          "Snackbar__item--success": toast.variant === "success",
        })}
      >
        <span className="Snackbar__message">{toast.message}</span>
        <button className="Snackbar__close" onClick={() => onRemove(toast.id)} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
};
