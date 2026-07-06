import { useState, useCallback } from "react";

export type ToastVariant = "error" | "success";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  timestamp: Date;
}

const DISMISS_MS = 4000;

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string = "An error has occurred", variant: ToastVariant = "error") => {
      const id = Date.now().toString();
      setToasts([{ id, message, variant, timestamp: new Date() }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DISMISS_MS);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};
